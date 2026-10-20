---
id: DB-INDEX-DESIGN
title: 'Índices compuestos, parciales y covering: diseña desde la consulta'
published: 2026-10-17T00:07:00Z
locale: es
translationKey: database-composite-partial-covering-indexes
slug: indices-compuestos-parciales-covering
draft: true
status: draft
level: intermedio
prerequisites: [DB-INDEXES]
description: 'Diseña índices para filtros, ORDER BY y LIMIT. Entiende el orden de columnas, los predicados parciales y cuándo INCLUDE permite un index-only scan.'
author: 'Luis Ramírez Calle'
series: 'Fundamentos de bases de datos'
tags: ['postgresql', 'indices', 'sql', 'rendimiento', 'query-plans']
---

La pantalla muestra los diez últimos eventos de un cliente. Has creado un índice en `tenant_id` y otro en `created_at`, pero la consulta todavía lee demasiadas filas o necesita ordenarlas.

Indexar las columnas por separado no equivale a construir una estructura que ordene los eventos **dentro de cada tenant**. Para decidir qué índice crear, necesitamos mirar juntos filtro, ordenación y datos solicitados.

Esta segunda parte continúa [fundamentos de índices](/posts/indices-postgresql-fundamentos). Vamos a diseñar un índice compuesto, otro para un subconjunto de filas y uno con datos incluidos, sin convertir cada consulta en una colección de índices.

## El orden de las columnas expresa un acceso

Un **composite index** B-tree sobre `(tenant_id, created_at DESC)` agrupa primero por tenant y, dentro de cada valor, ordena por fecha descendente.

<img src="/assets/visuals/database-series/indices-diseno.svg" alt="La consulta filtra tenant 42 y pide diez fechas descendentes. El índice usa tenant y fecha como claves; status va en INCLUDE como dato, no como clave de búsqueda." width="543" height="892" loading="lazy" style="width:100%;height:auto" />

[Ampliar el recurso visual](/assets/visuals/database-series/indices-diseno.svg).

Es un acceso apropiado para `WHERE tenant_id=42 ORDER BY created_at DESC LIMIT 10`. Un índice solo de fecha puede recorrer muchos eventos de otros tenants antes de encontrar diez del que buscamos.

La regla «igualdades primero, rango después» es un punto de partida, no una ley universal. Importan los operadores, la ordenación y qué consultas compartirán el índice. PostgreSQL 18 puede usar **skip scan** en determinados casos: afirmar que un B-tree jamás sirve sin filtrar su primera columna sería demasiado absoluto. Eso tampoco hace intercambiables todos los órdenes. [Índices multicolumna](https://www.postgresql.org/docs/18/indexes-multicolumn.html).

## Construye índices para dos accesos diferentes

[Consulta el laboratorio en GitHub](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/database-fundamentals/sql/08-indices-diseno.sql), entra en `database-fundamentals/` y ejecuta:

Archivo: terminal.

```bash
docker compose up -d --wait
docker compose exec -T postgres psql -X -U lab -d series_lab -v ON_ERROR_STOP=1 -f /lab/sql/08-indices-diseno.sql
```

Archivo: `database-fundamentals/sql/08-indices-diseno.sql`.

```sql
\ir 07-indices.sql
CREATE INDEX events_tenant_date ON db_perf.events(tenant_id,created_at DESC) INCLUDE (status);
CREATE INDEX events_pending ON db_perf.events(created_at) WHERE status='pending';
EXPLAIN (ANALYZE,BUFFERS)
SELECT created_at,status FROM db_perf.events
WHERE tenant_id=42 ORDER BY created_at DESC LIMIT 10;
EXPLAIN (ANALYZE,BUFFERS)
SELECT id FROM db_perf.events WHERE status='pending' ORDER BY created_at LIMIT 10;
```

El primer índice sirve a la pantalla por tenant. El segundo sirve a una consulta global de eventos pendientes. No se creó uno de cada tipo porque fueran una lista de buenas prácticas: son preguntas diferentes sobre el mismo dataset.

`\ir` reinicia el esquema didáctico `db_perf` y crea cien mil eventos deterministas. En estos datos `tenant_id` y `status` están correlacionados por cómo se generan; no debemos asumir independencia estadística ni extrapolar su distribución a una aplicación real.

## Un índice parcial contiene solo las filas que cumplen el predicado

Un **partial index** como `WHERE status='pending'` evita indexar todos los eventos completados. La consulta debe permitir al planner deducir que las filas necesarias están dentro de ese subconjunto. [Índices parciales](https://www.postgresql.org/docs/18/indexes-partial.html).

Cambiar el estado implica también cambiar la pertenencia al índice. Si casi todos los eventos están pendientes, su ahorro de tamaño puede ser pequeño. Si necesitas consultar el historial de completados, este índice no lo cubre.

Hay una sutileza con consultas parametrizadas: un plan genérico para `WHERE status=$1` no puede asumir que el parámetro siempre será `'pending'`. Un plan personalizado puede disponer de ese valor. No concluyas que un índice parcial funciona igual con todos los planes preparados.

Los índices únicos parciales también permiten expresar reglas sobre un subconjunto, por ejemplo una sola asignación activa por recurso. Esa es una garantía de integridad adicional; un índice parcial no único no impide duplicados.

## INCLUDE no convierte la columna en clave de búsqueda

**INCLUDE (status)** conserva `status` como dato adicional del índice. No cambia el orden de las claves ni permite buscar por `status` como si estuviera al principio.

Un **covering index** contiene los valores requeridos por la consulta. Eso hace posible un **index-only scan**, pero no garantiza que se eviten todas las visitas al heap: PostgreSQL necesita comprobar visibilidad, y su **visibility map** determina cuándo puede hacerlo sin visitar las páginas de la tabla. [Index-only scans](https://www.postgresql.org/docs/18/indexes-index-only-scans.html).

Puedes observar `Heap Fetches` en el plan y comparar antes y después de `VACUUM (ANALYZE) db_perf.events;`, fuera de una transacción explícita. No desactives autovacuum para lograr una captura bonita. El estado de mantenimiento es parte del comportamiento que quieres entender.

Incluir columnas grandes encarece tamaño y mantenimiento. No añadas el documento completo a todos los índices para evitar cualquier acceso a la tabla.

## Dos índices separados pueden combinarse, pero no son el mismo diseño

El planner puede combinar índices mediante un **bitmap scan**. Es útil para ciertos filtros, pero no conserva necesariamente el orden que necesita tu `ORDER BY`.

Si buscas diez registros ya ordenados, evitar un sort y detener la lectura pronto puede importar más que combinar dos filtros independientes. Si cambias la consulta para solicitar gran parte de la tabla, el mejor acceso también puede cambiar.

El método es iterativo: formula la consulta, observa su distribución, propone un índice, mide y revisa qué otras escrituras o lecturas has encarecido. Guarda también el plan anterior; «ahora usa índice» no es un criterio suficiente de éxito.

## Código del artículo

Consulta los [archivos y pruebas de este post](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/db-index-design/README.md). Clona el repositorio y ejecuta los comandos del artículo desde este paquete:

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples/packages/database-fundamentals
```

## Garantías y límites

El índice compuesto ofrece un orden de acceso. El parcial contiene el subconjunto declarado. `INCLUDE` aporta valores adicionales. Ninguno promete un plan concreto para todos los tamaños, parámetros o configuraciones.

El laboratorio ejecuta las consultas y permite inspeccionar sus planes; no obliga a una forma exacta del plan como si fuera parte del contrato SQL. Cambios legítimos del planner no deben confundirse con resultados incorrectos.

## Ejercicio: una ordenación con empate

Modifica la pantalla para usar `ORDER BY created_at DESC,id DESC`. Añade fechas repetidas y razona si el índice actual satisface completamente el nuevo orden o si necesita otra clave.

Acepta el ejercicio cuando la paginación tenga un orden definido y hayas medido el coste de cualquier índice adicional. Continúa con [lectura de EXPLAIN ANALYZE](/posts/explain-analyze-postgresql).

## Referencias

PostgreSQL 18, consultado el 17 de octubre de 2026: [índices multicolumna](https://www.postgresql.org/docs/18/indexes-multicolumn.html), [índices parciales](https://www.postgresql.org/docs/18/indexes-partial.html), [index-only scans y covering indexes](https://www.postgresql.org/docs/18/indexes-index-only-scans.html) y [CREATE INDEX](https://www.postgresql.org/docs/18/sql-createindex.html).
