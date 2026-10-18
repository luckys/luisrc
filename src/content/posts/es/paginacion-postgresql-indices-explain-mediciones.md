---
id: API-PAGINATION-PERFORMANCE
title: 'Medir paginación en PostgreSQL: índices, filtros y planes de ejecución'
published: 2026-10-18T04:09:00Z
locale: es
translationKey: paginacion-postgresql-indices-explain-mediciones
slug: paginacion-postgresql-indices-explain-mediciones
draft: true
status: draft
level: intermedio
prerequisites: [P024, API-PAGINATION-CONSISTENCY]
description: 'Compara planes y siete muestras por estrategia sobre un millón de filas. Índices covering, filtros, búsqueda y límites del benchmark.'
author: 'Luis Ramírez Calle'
series: 'Diseño de APIs y seguridad web: contratos, identidad y permisos'
tags: [api, postgresql, indices, rendimiento, explain]
---

Dos consultas devuelven los mismos cincuenta pedidos, pero una produce cientos de miles de filas antes de descartarlas. El resultado visible no explica por sí solo el trabajo del motor.

Ya hemos separado [la navegación](/posts/paginacion-offset-keyset-postgresql-concurrencia) de [su consistencia bajo escrituras](/posts/paginacion-escrituras-concurrentes-snapshots). Ahora podemos medir el coste sin presentar una diferencia de aislamiento como si fuera una optimización.

<img src="/assets/visuals/api-contracts/API-PAGINATION-PERFORMANCE.svg" alt="El filtro fija tenant y estado, el B-tree proporciona el orden y LIMIT recibe filas. OFFSET descarta anteriores; keyset comienza desde un ancla conocida." width="429" height="624" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/api-contracts/API-PAGINATION-PERFORMANCE.svg).

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

## Actual Rows no significa todas las filas visitadas ni páginas de disco

El archivo de resultados conserva el plan completo, no solo una cifra de milisegundos. El contador publicado es Actual Rows multiplicado por Actual Loops en el nodo de scan. Indica cuántas filas entrega ese nodo a su padre en estos planes.

Con OFFSET 300.000 y LIMIT 50, ese scan emite 300.050 filas y el nodo superior descarta las anteriores. Keyset parte de la frontera conocida y emite 50. La diferencia explica trabajo evitado, pero no mide por sí sola comparaciones internas, accesos físicos o uso de CPU total.

Los buffers del plan ayudan a estudiar otro aspecto del trabajo. Una página encontrada en caché no equivale a una lectura de disco frío. Tampoco debemos sumar indiscriminadamente contadores de nodos padres e hijos como si representaran recursos independientes.

Si el planner eligiera otra estrategia, el verificador pide revisar el protocolo: no fabrica un número equivalente mezclando scans o un plan paralelo. Es más útil reconocer que la comparación cambió que conservar una gráfica cuyo contador ya no significa lo mismo.

## Las muestras son observaciones locales, no una ley sobre cualquier página

Se alterna el orden de las estrategias para no ejecutar siempre una después de la otra. Siete muestras permiten conservar variación y recalcular la mediana; no bastan para estimar percentiles bajo carga o prometer un SLA.

El plan utiliza un índice covering sobre datos sintéticos y calientes. Un listado con otros filtros, joins, payload mayor o columnas sin cubrir puede tener otro coste. El punto de esta medición es seguir una consulta definida y sus planes, no afirmar que cualquier endpoint keyset tarda unas centésimas de milisegundo.

El archivo guarda hashes del SQL, del código de medición y del runtime. Los tests recalculan medianas y comparan la tabla. Si modificas el experimento y regeneras resultados, debes actualizar también la gráfica y el ZIP: una prueba verde del SQL no actualiza el texto por ti.

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

El [laboratorio](/assets/examples/api-paginacion-evolucion-lab.zip) incluye SQL, 56 planes medidos, muestras sin agregar y entorno. La ejecución usa PostgreSQL 17.11 con dos CPU y límite de 1536 MiB, datos en tmpfs y una imagen ya local fijada por digest.

```bash
pnpm install --frozen-lockfile
pnpm lab
```

El comando sustituye los resultados locales por una nueva ejecución, cuyos tiempos pueden diferir. El README describe el coste del ancla excluido, el calentamiento y los límites. La base y el contenedor son privados y efímeros.

Los tests de búsqueda ejecutan SQL parametrizado, no un endpoint q o un ranking. Las pruebas de escrituras son independientes del benchmark; no se insertan pedidos durante estas muestras. No medimos latencia HTTP, disco frío, QPS o clientes simultáneos.

## Ejercicio: quitar una columna del índice sin adivinar el resultado

En una copia del laboratorio, retira una columna de INCLUDE y conserva la misma representación solicitada. Ejecuta de nuevo, compara el plan y explica qué accesos cambian. No concluyas que un índice es mejor solo por una muestra rápida ni atribuyas a la caché una lectura que no observaste.

Continúa con [compatibilidad y contract tests](/posts/evolucion-api-versiones-consumidores-contratos): una mejora interna debería conservar lo que espera el consumidor.

## Referencias

- [PostgreSQL: índices y ORDER BY](https://www.postgresql.org/docs/17/indexes-ordering.html).
- [PostgreSQL: Index Only Scans](https://www.postgresql.org/docs/17/indexes-index-only-scans.html).
- [PostgreSQL: lectura de EXPLAIN](https://www.postgresql.org/docs/17/using-explain.html).
- [PostgreSQL: índices para búsqueda de texto](https://www.postgresql.org/docs/17/textsearch-indexes.html).

Cifras de la ejecución archivada, no un SLA; fuentes consultadas el 18 de octubre de 2026.
