# Paginación y evolución de APIs, P024/P025

## Ruta editorial de cinco entregas

| Parte                     | Archivos principales                           | Evidencia                                               |
| ------------------------- | ---------------------------------------------- | ------------------------------------------------------- |
| OFFSET, keyset y cursores | queries.mjs, pagination.mjs, server.mjs        | tests/unit.test.mjs, tests/http.test.mjs                |
| Escrituras y snapshots    | experiments.mjs, tests/postgres.test.mjs       | Dos conexiones, INSERT, clave mutable y REPEATABLE READ |
| Índices y mediciones      | schema.sql, experiments.mjs, results/          | 56 planes, muestras y hashes; ancla excluida            |
| Compatibilidad            | representations.mjs, clients.mjs, openapi.json | unit, HTTP y contract tests                             |
| Versionado y migración    | server.mjs, migration.html                     | Headers y guía local por HTTP                           |

El visor acompaña consistencia y es un modelo, no PostgreSQL o un benchmark.
Las doce entregas de la serie mantienen tres laboratorios compartidos, no doce APIs.

## Ejecutar

Español, datos ficticios, loopback. Node 24.19.0, pnpm 12.8.1, pg 8.23.1,
Ajv 8.20.0. PostgreSQL 17.11 fijado por digest en runtime.json. No exponer en red.

```bash
pnpm install --frozen-lockfile
pnpm test
pnpm lab
```

`pnpm test`: trece tests Node, HTTP con fuente de filas controlada y visor, sin Docker.
`pnpm lab`: exige Docker y la imagen **ya local**, nunca hace pull. Crea un
contenedor privado, un millón de filas, índices, ejecuta también seis tests con
PostgreSQL y archiva siete muestras por estrategia/profundidad. Al finalizar elimina
solo su contenedor y su base efímera; no conecta bases de datos externas. No usa
volúmenes persistentes o carpetas de datos del host. Necesita espacio de RAM para
tmpfs y dos CPU, con límite de memoria 1536 MiB. No ejecutar sobre un servicio real.

## Probar manualmente

```bash
node run.mjs serve
```

Imprime una URL con puerto efímero. Sustituye PUERTO:

```bash
curl -i 'http://127.0.0.1:PUERTO/v1/orders?pageSize=2&status=paid'
curl -i 'http://127.0.0.1:PUERTO/v2/orders?pageSize=2&status=paid'
curl -i 'http://127.0.0.1:PUERTO/migration/v2'
```

Copia nextCursor y envíalo como after en la **misma versión y filtro**. pageSize
1–100, por defecto 50; status paid/pending. No acepta parámetros repetidos,
desconocidos o un sort arbitrario. nextCursor null indica fin. El cursor se calcula
sobre la última fila entregada; la consulta usa una fila extra para lookahead.
Ctrl+C cierra el servidor y elimina la base/contenedor privados. Reiniciar cambia la
clave efímera de firma y restablece el conjunto de datos.

## Qué demuestra cada archivo

- schema.sql: datos sintéticos, fechas empatadas en milisegundos, dos tenants y
  estados, B-tree covering y GIN de búsqueda española. Un millón de filas iniciales;
  400.000 cumplen tenant 1/paid. Índices y VACUUM ANALYZE antes de los tiempos.
- queries.mjs: primera página, keyset y OFFSET; filtros y orden total idénticos.
- pagination.mjs: query acotada, cursor HMAC-SHA256, ámbito, versión y caducidad.
  Bigint como string, fecha sin perder precisión por usar timestamptz(3).
- representations.mjs: v1 baseline/aditiva y v2. breaking es fallo inyectado de test,
  nunca un parámetro público. La unidad del importe EUR no cambia.
- clients.mjs: dos lectores con expectativas diferentes, no SDKs publicados.
- server.mjs: HTTP real, tenant **fijo ficticio**, sin autenticación; 400/500 seguros.
  Deprecation RFC 9745 y Sunset RFC 8594 solo en v1; guía servida por HTTP.
- openapi.json: dos operaciones y schemas validados con Ajv sobre respuestas;
  no certifica todo OpenAPI ni genera el servidor automáticamente.
- experiments.mjs: planes JSON, calentamiento, alternancia y siete muestras.
  Dos conexiones vivas y un INSERT confirmado entre consultas READ COMMITTED.
- tests/postgres.test.mjs: solo mediante run.mjs, nunca base externa por defecto.
  REPEATABLE READ, keyset con clave mutable, búsqueda directa, filtros y clientes.
- results/: observaciones archivadas, no objetivos de rendimiento o SLA.

## Protocolo de medición

EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) con LIMIT 50; profundidades 0/10k/100k/300k.
Una consulta de calentamiento por estrategia y siete rondas, alternando el orden.
Cachés calientes, datos en tmpfs, sin vaciarlas. Execution Time del servidor con
instrumentación; no mide red, HTTP, serialización, usuarios simultáneos o disco frío.

El cursor ya es conocido. Obtener el ancla con OFFSET se hace **fuera** del tiempo:
esto compara continuación, no salto gratis a una página arbitraria. scanOutputRows
es Actual Rows × Actual Loops del scan, no lecturas físicas ni todas las visitas
internas del B-tree. Si el planner cambia de estrategia, el verificador exige revisar
el protocolo en vez de fabricar un contador comparable. Se conservan planes completos.

La prueba de consistencia intercala una escritura confirmada entre páginas, con dos
conexiones distintas. No inserta durante los timings. Las seis pruebas PostgreSQL
son distintas de las trece sin Docker; pnpm lab ejecuta las diecinueve.

## Límites y seguridad

Sin identidades, permisos, pagos, rate limiting, TLS, rotación de claves, revocación,
exportaciones consistentes o migración de consumidores externos. Cursor firmado no
es autorización ni cifrado. La clave se genera por proceso, no hay clave de producción
en el ZIP. Solo la fixture de unit tests tiene una clave fija pública.

El servidor de paginación solo acepta GET; no se usa como sustituto del laboratorio
de validación de POST. La búsqueda GIN se prueba directamente en SQL, no se ofrece q
ni ranking. Cambiar filtros exige otro recorrido. Cambiar columnas de orden puede
repetir filas; keyset no congela un snapshot. Fechas de deprecación/retirada ficticias;
la demo sigue sirviendo v1 y no la apaga automáticamente.

Un error de transporte o interno no divulga el mensaje del driver. No hay un sistema
completo de logging/tracing en esta entrega. Los lectores validan lo que usan, no toda
la semántica de una respuesta; se comprueba además su significado con fixtures.
