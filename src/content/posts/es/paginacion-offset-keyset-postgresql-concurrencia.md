---
id: P024
title: 'Paginación con PostgreSQL: por qué OFFSET repite filas y qué resuelve keyset'
published: 2026-10-18T04:04:00Z
locale: es
translationKey: api-pagination-postgresql-offset-keyset
slug: paginacion-offset-keyset-postgresql-concurrencia
draft: true
status: draft
level: intermedio
prerequisites: [P021]
description: 'Compara OFFSET y keyset en un millón de filas reales. Orden compuesto, cursores, filtros, búsqueda, planes y límites bajo escrituras concurrentes.'
author: 'Luis Ramírez Calle'
series: 'Diseño de APIs y seguridad web: contratos, identidad y permisos'
tags: [api, postgresql, paginacion, indices, concurrencia]
---

La segunda página repite un pedido que ya aparecía en la primera. La consulta tiene `ORDER BY`, el servidor devuelve 200 y nadie ha enviado dos veces el mismo registro. Entre ambas peticiones se insertó un pedido y cambió la posición de los demás.

Paginar no consiste solo en poner un límite al JSON. Hay que decidir qué significa «continuar», cómo se ordenan los empates y qué puede observar el usuario mientras los datos cambian.

Ampliamos el [modelo introductorio de cursores](/posts/evolucion-api-paginacion-contratos) con **PostgreSQL real y un millón de filas**. Después de estudiar [errores y conflictos](/posts/errores-api-problem-details-stock-concurrencia), toca hacer explícitas las garantías de una lectura por partes.

## OFFSET cuenta posiciones, no recuerda el último pedido

Una página de tamaño 50 con `OFFSET 10000` descarta las primeras 10.000 filas del resultado ordenado y devuelve las siguientes 50. Resulta sencillo convertir un número de página en desplazamiento y permite saltar directamente a una posición.

Pero «posición 10.001» no identifica un pedido. Si insertamos una fila antes de esa posición, los registros se desplazan. Si borramos una anterior, también. No hace falta que falle una consulta para que dos páginas correspondan a listas diferentes.

**Keyset pagination** utiliza la clave del último elemento entregado: «dame los siguientes después de este punto del orden». Un **cursor** es la representación que transporta ese punto. No son sinónimos: un token también podría contener un OFFSET y seguir teniendo sus problemas.

## El orden debe resolver todos los empates

Ordenamos por `created_at DESC, id DESC`. Primero aparecen los pedidos más recientes; entre dos con la misma fecha, aparece antes el de mayor ID. La fecha no basta porque varias filas pueden compartirla.

El ID es único y ambos campos son `NOT NULL`. Esas decisiones simplifican la comparación. Si permitimos `NULL`, mezclamos direcciones o cambiamos la collation, necesitamos revisar tanto el cursor como el predicado. No basta con copiar el operador menor que a cualquier orden.

Archivo `queries.mjs`, consulta completa para continuar:

```sql
SELECT id, tenant_id, status, created_at, amount_minor, currency, description
FROM orders
WHERE tenant_id = $1 AND status = $2
  AND (created_at, id) < ($3::timestamptz, $4::bigint)
ORDER BY created_at DESC, id DESC
LIMIT $5
```

Los placeholders reciben valores mediante el driver **pg**, no mediante concatenación del query string. La comparación de filas es lexicográfica: una fecha menor continúa el recorrido; si las fechas empatan, decide el ID. Como avanzamos en orden descendente, utilizamos `<`.

La primera página usa otra consulta sin el predicado del cursor. Conserva exactamente los mismos filtros y `ORDER BY`. Los tests comparan sus resultados con OFFSET sobre datos quietos, incluidos grupos con fechas empatadas.

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

<img src="/assets/visuals/api-contracts/P024.svg" alt="Tras leer una página, otra conexión inserta delante. OFFSET cuenta posiciones nuevas y repite el último ID; keyset continúa desde la clave anterior, sin incorporar el pedido insertado delante." width="381" height="1136" loading="lazy" style="width:100%;height:auto" />

[Ampliar la secuencia de paginación](/assets/visuals/api-contracts/P024.svg).

Puedes [explorar los cambios entre páginas](/assets/interactive/api-pagination/explorer.html) con un visor que permite insertar, mover o borrar una fila. Es un modelo en memoria, no una consulta en vivo ni una medición. La opción de inserción reproduce los IDs de la observación SQL anterior; las otras permiten examinar sus límites.

## Keyset no congela los datos entre peticiones

Evitar ese desplazamiento no equivale a leer un **snapshot**. Una fila nueva situada después del cursor podría aparecer. Un borrado podría quitar una fila que aún no hemos leído. Y cambiar la clave de ordenación puede mover un registro de un lado a otro de la frontera.

Otro test lo demuestra: mueve una fila ya entregada a una fecha anterior al cursor y comprueba que vuelve a aparecer al continuar. Por eso conviene que una fecha de creación utilizada como clave de navegación sea inmutable. Si el requisito es ordenar por una puntuación que cambia continuamente, hay que asumir otras garantías.

También probamos **REPEATABLE READ**: dentro de una misma transacción, la lectora conserva su snapshot aunque otra conexión confirme una inserción. Al terminar esa transacción, una consulta nueva ya ve el pedido insertado.

Mantener una transacción abierta mientras una persona navega varias pantallas no suele ser una buena solución: retiene recursos y puede prolongar la vida de versiones antiguas de filas. Una exportación consistente puede necesitar un job con snapshot y ciclo de vida propios. Una frontera temporal ayuda bajo ciertas hipótesis, pero no congela por sí sola modificaciones o borrados.

## El índice debe corresponder al filtro y al orden

El conjunto de datos contiene dos tenants ficticios y estados `paid` y `pending`. De las 1.000.000 filas, 400.000 cumplen `tenant_id = 1 AND status = 'paid'`, el recorrido medido. No estamos comparando una búsqueda sin filtros con otra que devuelve menos candidatos.

Archivo `schema.sql`, índice utilizado:

```sql
CREATE INDEX orders_page ON orders (tenant_id, status, created_at DESC, id DESC)
INCLUDE (amount_minor, currency, description);
```

Las igualdades fijan el prefijo del índice y el resto proporciona el orden. Las columnas de `INCLUDE` permiten cubrir la representación de esta consulta; no añaden otra ordenación. Tras la carga ejecutamos `VACUUM ANALYZE` para actualizar estadísticas y visibilidad.

En los planes archivados se utiliza **Index Only Scan**. Eso no garantiza cero accesos al heap en cualquier situación: depende, entre otras cosas, de la visibilidad de las páginas. Tampoco convierte OFFSET en un salto directo dentro del índice. Sigue necesitando producir y descartar filas anteriores.

El índice ocupa espacio y encarece escrituras. Si solo necesitáramos ID y fecha, incluir descripciones no sería una decisión gratuita. Para profundizar en esa elección, la entrega sobre [índices compuestos y covering](/posts/indices-compuestos-parciales-covering) desarrolla esos costes.

## Medición: continuar desde una clave no cuesta lo mismo que buscar una página arbitraria

Medimos consultas de 50 filas con **EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)**. Una ejecución de calentamiento por estrategia, siete muestras alternando el orden y cuatro profundidades. PostgreSQL 17.11, dos CPU asignadas al contenedor, 1.536 MiB de memoria, datos efímeros en tmpfs y cachés calientes. El entorno completo y los planes están en el ZIP.

La clave de continuación ya está disponible al medir keyset. **No incluimos el coste de obtener esa ancla mediante OFFSET**. Es la situación de un usuario que recibió el cursor de la página anterior, no una promesa de saltar a la página 6.001 sin recorrer ni localizar nada antes.

<div class="overflow-x-auto" role="region" aria-label="Medianas de las consultas SQL locales" tabindex="0">

<div style="min-width:42rem">

| Filas previas | OFFSET, mediana ms | Keyset, mediana ms | Salida del scan OFFSET / keyset |
| ------------- | ------------------ | ------------------ | ------------------------------- |
| 0             | 0,022              | 0,023              | 50 / 50                         |
| 10.000        | 2,067              | 0,054              | 10.050 / 50                     |
| 100.000       | 7,671              | 0,024              | 100.050 / 50                    |
| 300.000       | 24,802             | 0,027              | 300.050 / 50                    |

</div>

</div>

<img src="/assets/visuals/api-contracts/pagination-timings.svg" alt="Medianas de siete muestras locales: OFFSET aumenta con la profundidad; keyset con ancla conocida se mantiene cerca de unas centésimas de milisegundo. Eje vertical logarítmico, no escala lineal de diferencias." width="900" height="500" loading="lazy" style="width:100%;height:auto" />

[Ampliar la gráfica de las muestras locales](/assets/visuals/api-contracts/pagination-timings.svg).

La última columna cuenta filas **emitidas por el nodo de scan** según el plan. No cuenta lecturas físicas, páginas de disco ni todo el trabajo interno del índice. Los tiempos son `Execution Time` de PostgreSQL con instrumentación, no latencia HTTP ni un SLA. La gráfica usa escala logarítmica para mostrar cifras pequeñas sin ocultarlas; la tabla conserva sus valores.

Las mediciones se hacen sin escrituras simultáneas. El experimento de inserción y los tests de snapshots son pruebas separadas de consistencia. No deducimos rendimiento bajo carga a partir de mezclar ambos resultados.

## El cursor transporta una frontera, no concede acceso

La API del laboratorio devuelve `items` y `nextCursor`. Solicita `pageSize + 1` filas: entrega solo el tamaño pedido y utiliza la adicional para saber si existe continuación. El siguiente cursor se construye con la **última fila entregada**, no con esa fila extra, que de otro modo se saltaría.

El token contiene versión interna del formato, par fecha/ID, ámbito y expiración. Lo firmamos con **HMAC-SHA256** y comprobamos la firma antes de utilizarlo. Base64url no cifra el contenido: el cliente debe tratarlo como opaco, pero no debemos introducir secretos en él.

El ámbito incluye versión de API, tenant ficticio y filtro de estado. Cambiar `paid` por `pending` o pasar un cursor v1 a v2 exige empezar un recorrido nuevo. El tamaño de página sí puede cambiar dentro del máximo de 100. Un cursor caduca en una hora; reiniciar esta demo cambia la clave y también invalida los anteriores.

El ID viaja como string porque un `bigint` de PostgreSQL puede superar la precisión entera de un Number. La fecha se almacena como `timestamptz(3)`, alineada con los milisegundos de Date. No recortamos microsegundos de una columna más precisa al construir el cursor.

**No hay autenticación**: el tenant está fijado a uno en el servidor, no lo elige el cliente. Firmar un cursor no sustituye obtener el tenant de un contexto autorizado y aplicar permisos en cada consulta. Rotación de claves, revocación y cuotas quedan fuera de esta demo.

## Filtrar y buscar cambian qué significa continuar

Filtrar por estado selecciona un subconjunto exacto. Buscar texto aplica otra semántica: normalización, idioma, términos y, en algunos diseños, relevancia. No deberíamos ofrecer un `sort` arbitrario que se copie al SQL ni prometer el mismo coste para cualquier combinación.

El laboratorio crea un `tsvector` con configuración `spanish`, un índice **GIN** y prueba esta consulta parametrizada:

```sql
SELECT id FROM orders
WHERE tenant_id=$1 AND status=$2
  AND search @@ websearch_to_tsquery('spanish', $3)
LIMIT 5
```

Los valores del test son tenant uno, estado paid y el término camara. Demuestra una búsqueda de términos con PostgreSQL, no tolerancia general a erratas ni una ordenación por relevancia. El endpoint de páginas **no expone `q`**: la búsqueda se ejecuta directamente en el laboratorio SQL.

Combinar relevancia cambiante con cursor exigiría diseñar otro orden total y estudiar sus índices y estabilidad. No presentamos el índice B-tree del recorrido por fecha como solución universal de búsqueda.

## Garantías y límites

El [laboratorio descargable](/assets/examples/api-paginacion-evolucion-lab.zip) incluye SQL, servidor, tests, cursores y resultados. Para comprobarlo:

```bash
pnpm install --frozen-lockfile
pnpm test
pnpm lab
```

`pnpm test` no necesita Docker. `pnpm lab` exige la imagen PostgreSQL fijada **ya disponible localmente**, crea su propio contenedor y base efímera, ejecuta las pruebas reales y guarda nuevas mediciones. Elimina únicamente ese contenedor al terminar. No toca bases externas ni descarga imágenes automáticamente.

Para navegar manualmente, `node run.mjs serve` imprime una URL local y mantiene el entorno hasta Ctrl+C. El README explica los parámetros. Los tiempos publicados corresponden a la ejecución archivada; repetirla puede producir otros valores.

OFFSET sigue siendo razonable para conjuntos pequeños o cuando necesitas saltos por posición y aceptas su consistencia y coste. Keyset encaja con recorridos secuenciales sobre un orden apropiado. Ninguno decide automáticamente cómo debe funcionar una exportación consistente.

## Ejercicio: cambiar el orden sin perder empates

Diseña un recorrido ascendente. Cambia el ORDER BY, la comparación y los tests de empates de forma coherente. Después mueve una fila ya vista a otra posición y escribe qué garantía puedes mantener. No añadas «sin duplicados» al contrato si tu propio test demuestra lo contrario.

La siguiente entrega desarrolla [evolución de APIs con dos consumidores](/posts/evolucion-api-versiones-consumidores-contratos): incluso un cursor que funciona puede dejar de ser compatible si cambias su significado.

## Referencias

- [PostgreSQL 17: LIMIT y OFFSET](https://www.postgresql.org/docs/17/queries-limit.html).
- [Comparación de filas](https://www.postgresql.org/docs/17/functions-comparisons.html#ROW-WISE-COMPARISON) e [índices y ORDER BY](https://www.postgresql.org/docs/17/indexes-ordering.html).
- [Aislamiento transaccional](https://www.postgresql.org/docs/17/transaction-iso.html) y [lectura de EXPLAIN](https://www.postgresql.org/docs/17/using-explain.html).
- [PostgreSQL: índices de búsqueda de texto](https://www.postgresql.org/docs/17/textsearch-indexes.html).
- [Google AIP-158: diseño de paginación y tokens opacos](https://google.aip.dev/158).
- [Node: comparación de firmas y sus límites](https://nodejs.org/api/crypto.html#cryptotimingsafeequala-b).

Fuentes consultadas el 18 de octubre de 2026. Las cifras son observaciones de este laboratorio, no comparaciones universales entre estrategias.
