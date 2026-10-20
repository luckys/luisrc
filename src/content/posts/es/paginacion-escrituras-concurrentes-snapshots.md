---
id: API-PAGINATION-CONSISTENCY
title: 'Paginación bajo escrituras: qué conserva keyset y qué necesita un snapshot'
published: 2026-10-18T04:08:00Z
locale: es
translationKey: paginacion-escrituras-concurrentes-snapshots
slug: paginacion-escrituras-concurrentes-snapshots
draft: true
status: draft
level: intermedio
prerequisites: [P024]
description: 'Comprueba inserciones y claves mutables entre páginas con dos conexiones PostgreSQL. Distingue continuidad keyset de una vista consistente.'
author: 'Luis Ramírez Calle'
series: 'Diseño de APIs y seguridad web: contratos, identidad y permisos'
tags: [api, postgresql, paginacion, concurrencia, snapshots]
---

Una primera página es correcta y la segunda también lo es, pero al unirlas aparece un pedido dos veces. Las consultas observaron momentos diferentes. Ninguna prometía conservar la vista que existía al empezar el recorrido.

Después de [diseñar OFFSET, keyset y el cursor](/posts/paginacion-offset-keyset-postgresql-concurrencia), vamos a separar **continuar desde una clave** de **conservar un snapshot**. Lo comprobaremos con escrituras reales entre sentencias, no con una promesa basada únicamente en el nombre de la técnica.

## Una inserción entre páginas permite ver el fallo sin un benchmark

El laboratorio mantiene abiertas dos conexiones distintas. La lectora inicia una transacción **READ COMMITTED** y obtiene cinco pedidos. La escritora inserta y confirma un pedido con fecha posterior a todos ellos. La lectora pide la segunda página con ambos métodos.

Estos son los IDs obtenidos en la ejecución archivada:

<div class="overflow-x-auto" role="region" aria-label="IDs observados entre las dos páginas" tabindex="0">

| Lectura              | IDs en orden                               |
| -------------------- | ------------------------------------------ |
| Primera página       | 999998, 999996, 999994, 999992, **999988** |
| Segunda con OFFSET 5 | **999988**, 999986, 999984, 999982, 999978 |
| Segunda con keyset   | 999986, 999984, 999982, 999978, 999976     |

</div>

El nuevo pedido queda por delante. OFFSET descarta cinco posiciones de la lista nueva, no los cinco IDs ya vistos, y repite 999988. El predicado keyset continúa detrás de la última clave entregada, por lo que no repite esa fila.

No hacemos depender el resultado de una pausa ni de que «dé tiempo» a insertar. Esperamos la confirmación de la escritura antes de la segunda consulta y comprobamos que las conexiones tienen distintos backend PID. Es una escritura concurrente respecto a la transacción lectora, intercalada deliberadamente entre sus sentencias, no una carga aleatoria durante el benchmark.

<img src="/assets/visuals/api-contracts/API-PAGINATION-CONSISTENCY.svg" alt="Tras leer una página, otra conexión inserta delante. OFFSET cuenta posiciones nuevas y repite el último ID; keyset continúa desde la clave anterior, sin incorporar el pedido insertado delante." width="381" height="1136" loading="lazy" style="width:100%;height:auto" />

[Ampliar la secuencia de paginación](/assets/visuals/api-contracts/API-PAGINATION-CONSISTENCY.svg).

Puedes [explorar los cambios entre páginas](/assets/interactive/api-pagination/explorer.html) con un visor que permite insertar, mover o borrar una fila. Es un modelo en memoria, no una consulta en vivo ni una medición. La opción de inserción reproduce los IDs de la observación SQL anterior; las otras permiten examinar sus límites.

## Keyset no congela los datos entre peticiones

Evitar ese desplazamiento no equivale a leer un **snapshot**. Una fila nueva situada después del cursor podría aparecer. Un borrado podría quitar una fila que aún no hemos leído. Y cambiar la clave de ordenación puede mover un registro de un lado a otro de la frontera.

Otro test lo demuestra: mueve una fila ya entregada a una fecha anterior al cursor y comprueba que vuelve a aparecer al continuar. Por eso conviene que una fecha de creación utilizada como clave de navegación sea inmutable. Si el requisito es ordenar por una puntuación que cambia continuamente, hay que asumir otras garantías.

También probamos **REPEATABLE READ**: dentro de una misma transacción, la lectora conserva su snapshot aunque otra conexión confirme una inserción. Al terminar esa transacción, una consulta nueva ya ve el pedido insertado.

Mantener una transacción abierta mientras una persona navega varias pantallas no suele ser una buena solución: retiene recursos y puede prolongar la vida de versiones antiguas de filas. Una exportación consistente puede necesitar un job con snapshot y ciclo de vida propios. Una frontera temporal ayuda bajo ciertas hipótesis, pero no congela por sí sola modificaciones o borrados.

## READ COMMITTED cambia de vista entre sentencias aunque siga abierta la transacción

El experimento inicia una transacción lectora READ COMMITTED. Eso no fija una única vista para todas sus consultas: la siguiente sentencia puede observar una escritura que otra conexión confirmó después de la primera.

Por eso la inserción se hace con una segunda conexión viva y se espera a que termine. Si insertáramos dentro de la propia lectora, probaríamos otro caso. Si dejáramos la escritura sin confirmar, tampoco estaríamos comprobando la misma visibilidad. El test exige que los backend PID sean distintos para detectar una confusión accidental de conexiones.

En el caso observado, el nuevo pedido queda delante de todos los ya entregados. Keyset continúa detrás de la clave anterior y no lo incorpora. Esa ausencia no es una pérdida accidental: es consecuencia del recorrido definido. Si el producto debe mostrar nuevos pedidos delante, puede necesitar reiniciar o refrescar el listado.

## La prueba de REPEATABLE READ conserva una vista dentro de un alcance preciso

El segundo caso abre la lectora con esta sentencia, presente en `tests/postgres.test.mjs`:

```sql
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY
```

Primero lee una página y establece la vista. Otra conexión inserta y confirma un pedido nuevo. La lectora vuelve a consultar y no lo incorpora; después de COMMIT, una consulta nueva sí lo ve.

Las aserciones importan tanto como la configuración: exigimos que el segundo bloque no repita IDs de la primera página, que no incluya el nuevo pedido y que la lectura posterior al COMMIT lo encuentre. Esas observaciones distinguen una vista conservada de una prueba que simplemente nunca llegó a escribir.

La garantía pertenece a esa transacción PostgreSQL. No hemos mantenido el snapshot entre dos peticiones HTTP independientes ni creado un token capaz de reabrirlo. La API del laboratorio sigue ejecutando consultas ordinarias; no hay un endpoint de exportación consistente.

## Una clave mutable puede hacer reaparecer una fila con keyset

La prueba de actualización toma una fila de la primera página y cambia su fecha para colocarla detrás de la frontera guardada. Al continuar con el cursor original, la consulta vuelve a encontrarla.

El ID no cambia. Lo que cambia es su posición en el orden. Una firma válida del cursor no puede impedir que el conjunto se reorganice alrededor de él. El test comprueba la repetición y finalmente restaura la fecha para no contaminar las siguientes observaciones.

Elegir una clave inmutable evita ese desplazamiento concreto. No resuelve todos los demás: una inserción posterior a la frontera puede ser nueva candidata y un borrado puede eliminar una fila pendiente. Debemos especificar qué cambios acepta un recorrido de navegación y qué cambios hacen necesario otro mecanismo.

## El visor es útil si no lo confundimos con una base real

El [visor interactivo](/assets/interactive/api-pagination/explorer.html) permite insertar, mover o borrar sobre diez filas en memoria. La inserción reproduce los IDs archivados del caso SQL. Mover y borrar son simulaciones para examinar posiciones y fronteras.

La columna snapshot representa la vista inicial conservada del modelo; no demuestra que una aplicación web pueda mantenerla sin infraestructura adicional. El código del visor tiene tres tests y otro test editorial compara su inserción con el resultado real.

Puedes usarlo para predecir qué verás antes de leer los tests PostgreSQL. Después conviene comprobar la predicción contra el mecanismo real, sin atribuir al modelo tiempos, aislamiento o concurrencia de un servidor.

## Código del artículo

Consulta los [archivos y pruebas de este post](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/api-pagination-consistency/README.md). Clona el repositorio y ejecuta los comandos del artículo desde este paquete:

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples/packages/api-pagination-evolution
```

## Garantías y límites

El [laboratorio](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/api-pagination-evolution/tests/postgres.test.mjs) incluye la prueba de inserción, la de REPEATABLE READ y la de clave mutable. El conjunto inicial tiene un millón de filas ficticias.

```bash
pnpm install --frozen-lockfile
pnpm lab
```

El runner exige la imagen fijada ya local, crea su contenedor privado y lo elimina al terminar. No toca bases o volúmenes ajenos. Las escrituras se intercalan deliberadamente entre consultas: no es una medición de rendimiento bajo carga aleatoria.

No hay snapshot duradero de exportación, sesiones de navegación persistentes o autorización multi-tenant. Una transacción abierta durante el tiempo que tarda una persona en navegar requiere otras consideraciones de recursos y mantenimiento.

## Ejercicio: escribir la garantía antes del test

Decide si una lista debe mostrar filas insertadas durante el recorrido. Distingue las que quedan delante de la frontera y las que quedan detrás. Escribe un resultado esperado para cada caso y explica si necesitas navegación actualizada o una exportación consistente: son necesidades distintas.

Seguimos con [índices y mediciones de paginación](/posts/paginacion-postgresql-indices-explain-mediciones). Mantendremos separadas las pruebas de consistencia y las muestras de tiempo.

## Referencias

- [PostgreSQL: READ COMMITTED y REPEATABLE READ](https://www.postgresql.org/docs/17/transaction-iso.html).
- [PostgreSQL: MVCC](https://www.postgresql.org/docs/17/mvcc.html).
- [PostgreSQL: LIMIT y orden de resultados](https://www.postgresql.org/docs/17/queries-limit.html).

Fuentes consultadas el 18 de octubre de 2026.
