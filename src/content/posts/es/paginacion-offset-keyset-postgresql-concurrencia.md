---
id: P024
title: 'Paginación de APIs: OFFSET, keyset y cursores con un orden estable'
published: 2026-10-18T04:07:00Z
locale: es
translationKey: api-pagination-postgresql-offset-keyset
slug: paginacion-offset-keyset-postgresql-concurrencia
draft: true
status: draft
level: intermedio
prerequisites: [P021]
description: 'Diseña páginas con un orden total, compara OFFSET y keyset y construye cursores con lookahead, ámbito y límites explícitos.'
author: 'Luis Ramírez Calle'
series: 'Diseño de APIs y seguridad web: contratos, identidad y permisos'
tags: [api, paginacion, postgresql, contratos]
---

Una API devuelve cincuenta pedidos y un botón para continuar. ¿Significa «las cincuenta posiciones siguientes» o «los pedidos posteriores al último que ya recibí»? Las dos interpretaciones pueden coincidir sobre datos quietos y diferir cuando alguien escribe.

Antes de medir o estudiar snapshots, necesitamos fijar qué representa una página. Vamos a comparar **OFFSET** y **keyset**, resolver empates y construir el cursor del consumidor.

Las pruebas de escrituras se desarrollan después en [consistencia entre páginas](/posts/paginacion-escrituras-concurrentes-snapshots). La comparación de costes queda en [índices y mediciones](/posts/paginacion-postgresql-indices-explain-mediciones): primero necesitamos saber qué comportamiento estamos comparando.

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

<img src="/assets/visuals/api-contracts/P024.svg" alt="Un orden por fecha e ID deshace empates. OFFSET conserva una posición, mientras keyset conserva la clave del último elemento entregado." width="413" height="598" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/api-contracts/P024.svg).

## Leer la comparación con un empate concreto

Imagina dos pedidos con la misma fecha y los IDs 18 y 16. En orden descendente aparece primero 18. Si el tamaño es uno, el cursor de esa página debe conservar tanto la fecha como 18.

La condición «fecha menor» excluiría también al pedido 16 y lo saltaría. La comparación del par lo admite porque, al empatar la fecha, 16 es menor que 18. Si cambiamos el orden a ascendente, también debemos cambiar la dirección de la comparación; no es un detalle intercambiable.

El contrato de esta demo guarda fechas con precisión de milisegundos e IDs únicos. Los tests hacen coincidir keyset con OFFSET sobre el mismo conjunto quieto y prueban que hay fechas empatadas. Eso comprueba la continuidad básica antes de introducir otra conexión que inserte o modifique filas.

Los valores 18 y 16 son una explicación de la comparación, no los IDs del experimento medido. La [siguiente entrega](/posts/paginacion-escrituras-concurrentes-snapshots) muestra los IDs realmente observados en PostgreSQL.

## El cursor transporta una frontera, no concede acceso

La API del laboratorio devuelve `items` y `nextCursor`. Solicita `pageSize + 1` filas: entrega solo el tamaño pedido y utiliza la adicional para saber si existe continuación. El siguiente cursor se construye con la **última fila entregada**, no con esa fila extra, que de otro modo se saltaría.

El token contiene versión interna del formato, par fecha/ID, ámbito y expiración. Lo firmamos con **HMAC-SHA256** y comprobamos la firma antes de utilizarlo. Base64url no cifra el contenido: el cliente debe tratarlo como opaco, pero no debemos introducir secretos en él.

El ámbito incluye versión de API, tenant ficticio y filtro de estado. Cambiar `paid` por `pending` o pasar un cursor v1 a v2 exige empezar un recorrido nuevo. El tamaño de página sí puede cambiar dentro del máximo de 100. Un cursor caduca en una hora; reiniciar esta demo cambia la clave y también invalida los anteriores.

El ID viaja como string porque un `bigint` de PostgreSQL puede superar la precisión entera de un Number. La fecha se almacena como `timestamptz(3)`, alineada con los milisegundos de Date. No recortamos microsegundos de una columna más precisa al construir el cursor.

**No hay autenticación**: el tenant está fijado a uno en el servidor, no lo elige el cliente. Firmar un cursor no sustituye obtener el tenant de un contexto autorizado y aplicar permisos en cada consulta. Rotación de claves, revocación y cuotas quedan fuera de esta demo.

## La fila extra responde una pregunta distinta de la fila final

Con tamaño dos, el servidor pide tres filas. Si recibe A, B y C, entrega A y B, indica continuación y firma el cursor de B. C se utiliza solo para saber que queda algo más: empezará como candidata en la siguiente consulta.

Si construyéramos el cursor de C y la consulta continuara estrictamente detrás de él, C desaparecería del recorrido. El test HTTP comprueba el ID enviado al SQL siguiente y el límite pageSize más uno; no se limita a comprobar que el token sea un string.

Si la consulta devuelve como máximo dos filas, no hay lookahead y `nextCursor` es null. Eso evita una consulta COUNT completa solo para decidir si ofrecer otro paso. No conocemos por ello un total exacto de páginas.

## Elegir entre posición y continuidad tiene un coste de producto

OFFSET facilita «ir a página 20» porque el consumidor puede calcular un desplazamiento. Eso no garantiza bajo coste ni una vista consistente entre solicitudes. En un listado pequeño, con cambios poco relevantes para el uso, puede ser una decisión suficiente.

Keyset encaja con «siguiente» sobre un orden que conocemos. No permite saltar gratuitamente a una página arbitraria: necesitaríamos conocer su ancla, recorrer páginas previas o diseñar otro mecanismo. Tampoco incorpora automáticamente la navegación hacia atrás; habría que definir cursor, comparación y orden de retorno para ese sentido.

No publicamos un parámetro sort que se copie al SQL. El único orden de esta API está fijado por contrato. Si el producto necesita otras ordenaciones, cada una necesita resolver sus empates y estudiar sus índices, no aceptar un nombre de columna arbitrario.

## Código del artículo

Consulta los [archivos y pruebas de este post](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/p024/README.md). Clona el repositorio y ejecuta los comandos del artículo desde este paquete:

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples/packages/api-pagination-evolution
```

## Garantías y límites

El [laboratorio](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/api-pagination-evolution/pagination.mjs) incluye `queries.mjs`, `pagination.mjs` y `server.mjs`. Sus tests sin Docker comprueban ámbito, firma, caducidad, parámetros y lookahead.

```bash
pnpm install --frozen-lockfile
pnpm test
```

Para probar HTTP con PostgreSQL local utiliza `node run.mjs serve`. El README detalla la imagen ya local, el millón de filas sintéticas, el puerto efímero y el cierre con Ctrl+C. No se conecta una base externa.

El tenant es fijo y ficticio. No hay autenticación, claves duraderas, rotación, revocación o permisos. Un cursor correcto tampoco congela el conjunto: esa garantía se estudia por separado, no se deduce de la firma.

## Ejercicio: una página que termina en un empate

Usa tamaño uno y dos pedidos con igual fecha. Comprueba que ambos se entregan una sola vez sobre datos quietos. Después cambia el orden a ascendente y escribe primero el resultado esperado. Ajusta tanto el predicado como el ORDER BY para que el test vuelva a pasar.

Continúa con [qué ocurre cuando cambian los datos entre páginas](/posts/paginacion-escrituras-concurrentes-snapshots).

## Referencias

- [PostgreSQL: LIMIT y OFFSET](https://www.postgresql.org/docs/17/queries-limit.html).
- [Comparación de filas](https://www.postgresql.org/docs/17/functions-comparisons.html#ROW-WISE-COMPARISON).
- [Google AIP-158: tokens opacos de paginación](https://google.aip.dev/158).
- [Node: comparación de firmas y sus límites](https://nodejs.org/api/crypto.html#cryptotimingsafeequala-b).

Fuentes consultadas el 18 de octubre de 2026.
