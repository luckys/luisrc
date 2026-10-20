---
id: DB-PLANS
title: 'EXPLAIN ANALYZE en PostgreSQL: cómo investigar una consulta lenta'
published: 2026-10-17T00:08:00Z
locale: es
translationKey: database-explain-analyze
slug: explain-analyze-postgresql
draft: true
status: draft
level: intermedio
prerequisites: [DB-SQL, DB-INDEX-DESIGN]
description: 'Lee costes, filas reales, loops y buffers. Distingue estimaciones de mediciones, revisa estadísticas y detecta problemas que un plan aislado no muestra, como N+1.'
author: 'Luis Ramírez Calle'
series: 'Fundamentos de bases de datos'
tags: ['postgresql', 'explain', 'sql', 'rendimiento', 'observabilidad']
---

Una consulta tarda más de lo esperado y alguien propone añadir un índice. Puede ser la solución, pero también puede haber una estimación equivocada, una ordenación grande o cien consultas pequeñas lanzadas desde la aplicación.

**EXPLAIN** ayuda a dejar de adivinar. No interpreta por nosotros qué resultado necesita el producto, pero muestra cómo PostgreSQL planea obtenerlo y, con **ANALYZE**, qué ocurrió al ejecutarlo.

Esta entrega parte de [SQL](/posts/sql-joins-null-agregaciones) e [índices](/posts/indices-compuestos-parciales-covering). Aprenderás a distinguir costes de tiempos, localizar diferencias de cardinalidad y comprobar mejoras sin confundir un plan local con la latencia completa de una petición.

## El planner estima; el executor realiza el trabajo

El **planner** compara alternativas usando estadísticas y un modelo de costes. El **executor** realiza scans, joins, agregaciones y ordenaciones del plan elegido.

<img src="/assets/visuals/database-series/planes.svg" alt="El SQL llega al planner, que usa estadísticas y costes. El executor realiza scans, joins y sorts. EXPLAIN ANALYZE BUFFERS permite comparar estimaciones con filas, loops y buffers reales." width="577" height="812" loading="lazy" style="width:100%;height:auto" />

[Ampliar el recurso visual](/assets/visuals/database-series/planes.svg).

**EXPLAIN** muestra el plan sin ejecutar normalmente la sentencia. **EXPLAIN ANALYZE** sí la ejecuta y añade medidas. Con un `UPDATE`, `DELETE` o función con efectos no es una inspección inocua.

En escrituras experimentales puedes envolver el ensayo en una transacción y hacer rollback, pero no asumir que eso revierte efectos externos o el consumo de secuencias. Usa una base aislada para los ejemplos. [Guía de EXPLAIN](https://www.postgresql.org/docs/18/using-explain.html).

## Genera planes completos en lugar de copiar salidas ajenas

[Consulta el laboratorio en GitHub](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/database-fundamentals/sql/09-planes.sql). Desde `database-fundamentals/`, arranca `docker compose up -d --wait` y ejecuta:

Archivo: terminal.

```bash
docker compose exec -T postgres psql -X -U lab -d series_lab -v ON_ERROR_STOP=1 -f /lab/sql/09-planes.sql
```

Archivo: `database-fundamentals/sql/09-planes.sql`.

```sql
\ir 07-indices.sql
EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON)
SELECT id FROM db_perf.events WHERE tenant_id=42;
EXPLAIN (ANALYZE,BUFFERS)
SELECT id FROM db_perf.events WHERE tenant_id>=0;
SELECT attname,n_distinct FROM pg_stats
WHERE schemaname='db_perf' AND tablename='events';
```

La primera consulta pide cien filas; la segunda pide todas. Guardamos también planes JSON reales en `results/benchmark.json`. No presentamos aquí un árbol con tiempos inventados: tu plan concreto depende del entorno y del estado de la tabla.

## Lee filas, loops y tiempo sin sumar lo mismo dos veces

Una línea de plan puede mostrar `cost=inicio..total`, `rows` y `width`. El coste es una estimación en unidades del modelo, **no milisegundos**. `rows` estima cuántas filas emitirá ese nodo, no siempre cuántas examinará.

Con `ANALYZE`, `actual rows` y tiempos son valores medios por ejecución del nodo cuando hay varios **loops**. Para estimar el volumen total emitido, considera filas por loop multiplicadas por loops.

Los tiempos de nodos padres incluyen trabajo de sus hijos. Sumarlos todos como si fueran duraciones independientes sobrecuenta la ejecución. Empieza por `Execution Time` y sigue el árbol para entender de dónde viene, no para construir una suma incorrecta.

**Rows Removed by Filter** ayuda a descubrir trabajo descartado. Una consulta que devuelve diez filas después de revisar miles puede necesitar otro acceso, pero quizá ese coste sea perfectamente aceptable para su frecuencia.

## Buffers no equivale directamente a lecturas físicas del disco

`shared hit` indica un bloque encontrado en **shared buffers**. `shared read` indica que hubo que traerlo a esos buffers; puede haberlo servido la caché del sistema operativo, así que no demuestra por sí solo un acceso físico al dispositivo.

Un sort que usa archivos temporales o un hash que necesita varios lotes merece atención. Aumentar `work_mem` sin contexto es arriesgado porque puede aplicarse por operación y multiplicarse con consultas concurrentes.

La instrumentación también tiene coste. Compara mediciones repetidas, registra configuración y no mezcles tiempos obtenidos con métodos distintos como si fueran equivalentes.

## Una cardinalidad mal estimada puede llevar a otra estrategia

**ANALYZE** recopila estadísticas de distribución, valores frecuentes y otros datos que el planner utiliza para estimar. Después de cambios grandes, comprueba que las estadísticas sean adecuadas. [Estadísticas del planner](https://www.postgresql.org/docs/18/planner-stats.html).

Si estima diez filas y devuelve cien mil, investiga antes de culpar al operador final. Puede haber distribución sesgada, columnas correlacionadas o expresiones difíciles de estimar. Las **extended statistics** sirven para ciertas dependencias entre columnas, no para corregir cualquier estimación.

Un **nested loop join** repite la búsqueda interior para filas del lado exterior; puede ser muy apropiado con pocas filas y acceso indexado. Un **hash join** construye una estructura hash para combinar coincidencias. Un **merge join** combina entradas ordenadas. No son categorías de «bueno, malo y moderno»: su coste depende de volumen, memoria y accesos.

## N+1 puede quedar fuera del plan que estás mirando

Si la aplicación consulta una lista de cien clientes y luego hace una consulta de pedidos por cada uno, tienes **N+1** consultas. Cada plan individual puede ser rápido, pero acumulas viajes de red, planificación y acceso al pool.

Un join que devuelve el conjunto necesario o dos consultas por lotes pueden reducir viajes. Un join gigantesco también puede repetir datos y transferir demasiado. Compara filas, bytes, número de consultas y latencia completa, no únicamente el tiempo del servidor de una sentencia.

Para descubrirlo necesitas trazas o un contador de consultas en la aplicación. `EXPLAIN` de una consulta aislada no informa de las otras cien que ejecutaste alrededor.

## Código del artículo

Consulta los [archivos y pruebas de este post](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/db-plans/README.md). Clona el repositorio y ejecuta los comandos del artículo desde este paquete:

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples/packages/database-fundamentals
```

## Garantías y límites

El plan ejecutado muestra trabajo real de ese ensayo; no predice todas las combinaciones de parámetros, concurrencia y caché. Un plan mejor estimado tampoco garantiza una mejora perceptible si la petición espera principalmente a otro servicio.

El benchmark del laboratorio conserva siete muestras por variante y planes completos. No mide p95 bajo carga ni produce una recomendación universal de índices. La comparación debe conservar resultados correctos y parámetros equivalentes.

## Ejercicio: explica una mejora sin decir solo «usa índice»

Ejecuta `node tools/benchmark.mjs`. Anota filas devueltas, forma del acceso, buffers y mediana antes y después. Explica qué trabajo se evitó y qué nuevo coste de escritura introdujiste.

Acepta el ejercicio cuando otra persona pueda repetir el método y diferenciar datos medidos de hipótesis. El siguiente problema será cambiar ese esquema sin romper versiones existentes: [migraciones compatibles](/posts/migraciones-base-datos-sin-romper-aplicacion).

## Referencias

PostgreSQL 18, consultado el 17 de octubre de 2026: [EXPLAIN](https://www.postgresql.org/docs/18/using-explain.html), [estadísticas y extended statistics](https://www.postgresql.org/docs/18/planner-stats.html) y [guía de rendimiento](https://www.postgresql.org/docs/18/performance-tips.html). Las muestras del ejemplo están en `results/benchmark.json`, dentro del laboratorio.
