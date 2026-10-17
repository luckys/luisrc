---
id: DB-INDEXES
title: 'Índices en PostgreSQL: por qué aceleran algunas consultas y encarecen las escrituras'
published: 2026-10-17T00:06:00Z
locale: es
translationKey: database-indexes-fundamentals
slug: indices-postgresql-fundamentos
draft: true
status: draft
level: intermedio
prerequisites: [DB-SQL]
description: 'Entiende B-tree, selectividad, acceso a la tabla y coste de mantenimiento. Incluye una consulta reproducible y una gráfica medida antes y después del índice.'
author: 'Luis Ramírez Calle'
series: 'Fundamentos de bases de datos'
tags: ['postgresql', 'indices', 'sql', 'rendimiento', 'benchmark']
---

Una consulta devuelve cien filas de una tabla con cien mil. Sin un acceso apropiado, PostgreSQL puede tener que examinar toda la tabla para encontrarlas. Añadir un índice permite localizar candidatas sin recorrerlas todas, pero introduce otra estructura que cada escritura tendrá que mantener.

La decisión no es «índices sí o no». Es **qué acceso queremos acelerar, con qué distribución de datos y a cambio de qué coste**.

Después de [consultas correctas](/posts/sql-joins-null-agregaciones) y [normalización](/posts/normalizacion-desnormalizacion-datos), esta primera parte explica el mecanismo de un **B-tree**, la **selectivity** y el coste de escritura. En la [segunda parte](/posts/indices-compuestos-parciales-covering) diseñaremos índices para filtros y ordenaciones concretas.

## El índice localiza candidatas; la tabla conserva las filas

Un **B-tree** organiza claves de manera ordenada y mantiene caminos para localizar rangos de valores. No es una copia de la tabla ordenada físicamente por esa columna.

En el caso habitual, sus entradas permiten llegar a las filas de la tabla, el **heap**, donde PostgreSQL comprueba visibilidad y recupera datos necesarios. Un **index-only scan** puede evitar parte de esas visitas bajo determinadas condiciones; lo veremos en el siguiente artículo.

<img src="/assets/visuals/database-series/indices.svg" alt="Sin un índice apropiado, PostgreSQL recorre la tabla. Con B-tree localiza las entradas de tenant 42 y accede a las filas candidatas de la tabla." width="1231" height="422" loading="lazy" style="width:100%;height:auto" />

[Ampliar el recurso visual](/assets/visuals/database-series/indices.svg).

Esa estructura sirve para igualdad, rangos y ciertos órdenes. **Hash** se orienta a igualdad. **GIN** permite indexar componentes de valores, útil en determinados operadores sobre arrays, JSONB o búsqueda de texto. **GiST** es una infraestructura para distintas clases de operadores, por ejemplo búsquedas espaciales o rangos. No eliges el tipo por su nombre, sino por el operador y el dato que debe soportar. [Tipos de índices](https://www.postgresql.org/docs/18/indexes-types.html).

## Selectividad: cien filas de cien mil no es lo mismo que noventa mil

La **selectivity** de un filtro expresa qué fracción de filas coincide. En el ejemplo, cien de cien mil es el 0,1 %. Conviene distinguirlo del número de valores diferentes, a menudo llamado **distinct cardinality**.

Una columna con muchos valores distintos puede contener también un valor muy frecuente. Un índice útil para un identificador raro puede no convenir para ese valor dominante.

Visitar gran parte de la tabla mediante accesos al índice y al heap puede costar más que un recorrido secuencial. Por eso un **sequential scan** no es automáticamente un problema y un índice existente no obliga al planner a usarlo.

## Mide una consulta con el mismo dataset

[Descarga el laboratorio](/assets/examples/bases-de-datos-lab.zip). En `bases-de-datos/`, arranca `docker compose up -d --wait` y ejecuta el archivo con el siguiente comando.

Archivo: terminal.

```bash
docker compose exec -T postgres psql -X -U lab -d series_lab -v ON_ERROR_STOP=1 -f /lab/sql/07-indices.sql
```

Archivo: `bases-de-datos/sql/07-indices.sql`.

```sql
DROP SCHEMA IF EXISTS db_perf CASCADE;
CREATE SCHEMA db_perf;
CREATE TABLE db_perf.events (
  id integer PRIMARY KEY,
  tenant_id integer NOT NULL,
  created_at timestamp NOT NULL,
  status text NOT NULL,
  payload text NOT NULL
);
INSERT INTO db_perf.events
SELECT n,n%1000,timestamp '2026-01-01'+n*interval '1 minute',
  CASE WHEN n%100=0 THEN 'pending' ELSE 'done' END,repeat('x',100)
FROM generate_series(1,100000) AS n;
ANALYZE db_perf.events;
EXPLAIN (ANALYZE,BUFFERS)
SELECT id FROM db_perf.events WHERE tenant_id=42;
CREATE INDEX events_tenant ON db_perf.events(tenant_id);
EXPLAIN (ANALYZE,BUFFERS)
SELECT id FROM db_perf.events WHERE tenant_id=42;
SELECT pg_relation_size('db_perf.events_tenant') AS index_bytes;
```

El script reinicia solo `db_perf`. Genera datos deterministas: cada tenant tiene cien eventos. `ANALYZE` actualiza estadísticas antes de comparar. **EXPLAIN ANALYZE ejecuta la consulta**, por lo que no debe usarse despreocupadamente con escrituras de producción.

No hay que interpretar la columna `cost` como milisegundos. Para una primera comparación observa `Execution Time`, filas reales y buffers. Desarrollaremos su lectura en [planes de ejecución](/posts/explain-analyze-postgresql).

## Una gráfica medida, no una promesa de aceleración

<img src="/assets/visuals/database-series/consulta-indice-medicion.svg" alt="Gráfica del tiempo mediano de siete ejecuciones de la misma consulta sobre cien mil eventos, sin índice y con índice de tenant. Los resultados exactos están en benchmark.json." width="900" height="400" loading="lazy" style="width:100%;height:auto" />

[Ampliar el recurso visual](/assets/visuals/database-series/consulta-indice-medicion.svg).

La gráfica procede de `results/benchmark.json`, incluido en la descarga. Para repetir la medición ejecuta `node tools/benchmark.mjs`. El programa calienta una vez cada variante y guarda siete muestras de `Execution Time`, su mediana y los planes completos. El tiempo de abrir el cliente no forma parte de esa métrica del servidor.

Es un experimento sintético local, con datos en condiciones de caché caliente y sin carga concurrente. No mide latencia de una API ni percentiles bajo tráfico. El orden de ejecución y las cachés del sistema pueden influir. Úsalo para observar el mecanismo, no para anunciar que todos los endpoints mejorarán en la misma proporción.

## Cada índice también se escribe

Al insertar una fila no basta con añadirla al heap: hay que mantener los índices correspondientes. Las actualizaciones pueden requerir mantenimiento adicional según las columnas modificadas y el tipo de actualización. También ocupan espacio y generan trabajo de WAL.

El benchmark incluye otra comparación: insertar diez mil filas en una tabla sin índices y en otra equivalente con un B-tree. Guarda `WAL Records` y `WAL Bytes` de `EXPLAIN (ANALYZE,WAL)`. Ese dato muestra escritura adicional generada en este escenario; **no es una medida universal de write amplification del dispositivo** ni un benchmark estadístico de escrituras.

Un índice que acelera una consulta muy rara puede perjudicar una tabla que recibe escrituras constantemente. Revisa frecuencia de uso, tamaño y distribución, no solo que un plan aislado sea más corto.

## Garantías y límites

Un índice proporciona una vía de acceso; el planner puede preferir otra. No corrige resultados incorrectos, no sustituye a una política de retención y no garantiza que la tabla quepa en memoria.

`PRIMARY KEY` y `UNIQUE` ya crean índices que respaldan su unicidad. Crear otro idéntico suele añadir mantenimiento sin aportar una nueva vía de acceso. Una foreign key, en cambio, no crea automáticamente un índice en las columnas que referencian: hay que valorar sus consultas y operaciones de borrado o actualización.

## Ejercicio: filtrar casi toda la tabla

Compara `tenant_id=42` con `tenant_id>=0` usando `EXPLAIN (ANALYZE,BUFFERS)`. Ambas consultas deben devolver resultados correctos, pero no tienen por qué usar el mismo acceso.

Acepta el ejercicio cuando puedas justificar la elección sin decir «sequential scan siempre es malo». Sigue con [índices compuestos, parciales y covering](/posts/indices-compuestos-parciales-covering).

## Referencias

PostgreSQL 18, consulta del 17 de octubre de 2026: [índices](https://www.postgresql.org/docs/18/indexes.html), [tipos](https://www.postgresql.org/docs/18/indexes-types.html), [estadísticas del planner](https://www.postgresql.org/docs/18/planner-stats.html), [EXPLAIN](https://www.postgresql.org/docs/18/using-explain.html) y [WAL](https://www.postgresql.org/docs/18/wal-intro.html). Método y resultados propios: `tools/benchmark.mjs` y `results/benchmark.json` de la descarga.
