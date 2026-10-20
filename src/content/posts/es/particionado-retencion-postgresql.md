---
id: DB-PARTITIONING
title: 'Particionado y retención en PostgreSQL: divide una tabla cuando el acceso lo justifique'
published: 2026-10-17T00:10:00Z
locale: es
translationKey: database-partitioning-retention
slug: particionado-retencion-postgresql
draft: true
status: draft
level: intermedio
prerequisites: [DB-MIGRATIONS, DB-INDEXES]
description: 'Prueba range partitioning, partition pruning y DETACH PARTITION. Entiende límites temporales, unicidad, retención y por qué particionar no equivale a sharding.'
author: 'Luis Ramírez Calle'
series: 'Fundamentos de bases de datos'
tags: ['postgresql', 'particionado', 'retencion', 'bases-de-datos', 'operacion']
---

Una tabla de eventos conserva años de datos, pero la aplicación suele consultar la última semana y elimina cada mes lo que supera la retención. Un índice ayuda a buscar; no convierte por sí solo la retirada de millones de filas antiguas en una operación pequeña.

El **partitioning** permite organizar una tabla lógica en tablas físicas según una clave. Puede simplificar acceso y mantenimiento cuando esa división coincide con las consultas y el ciclo de vida del dato.

Esta entrega continúa [índices](/posts/indices-postgresql-fundamentos) y [migraciones](/posts/migraciones-base-datos-sin-romper-aplicacion). Vamos a probar rangos temporales, observar **partition pruning** y separar una partición sin borrar su contenido.

## Particionar no distribuye automáticamente el trabajo entre servidores

El particionado declarativo de PostgreSQL divide tablas dentro de su sistema de almacenamiento. No es **sharding** ni añade por sí solo nodos, memoria o capacidad de CPU.

Con **range partitioning**, cada partición acepta un intervalo. También existen **list partitioning** para valores concretos y **hash partitioning** para distribuir según un hash. La clave debe elegirse por accesos y mantenimiento, no porque una columna «parezca grande».

<img src="/assets/visuals/database-series/particionado.svg" alt="Events se divide en enero y febrero con intervalos que incluyen el inicio y excluyen el final. DETACH separa enero de la tabla padre y conserva sus datos." width="1499" height="422" loading="lazy" style="width:100%;height:auto" />

[Ampliar el recurso visual](/assets/visuals/database-series/particionado.svg).

Si todas tus consultas buscan un identificador sin fecha y necesitas examinar muchas particiones, dividir por meses puede no ayudarte. También puedes introducir más objetos, índices y trabajo de planificación.

## Un rango incluye su inicio y excluye su final

[Consulta el laboratorio en GitHub](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/database-fundamentals/sql/11-particionado.sql). Desde `database-fundamentals/`, arranca `docker compose up -d --wait` y ejecuta:

Archivo: terminal.

```bash
docker compose exec -T postgres psql -X -U lab -d series_lab -v ON_ERROR_STOP=1 -f /lab/sql/11-particionado.sql
```

Archivo: `database-fundamentals/sql/11-particionado.sql`.

```sql
DROP SCHEMA IF EXISTS db_partition CASCADE;
CREATE SCHEMA db_partition;
CREATE TABLE db_partition.events (
  id bigint NOT NULL,
  occurred_on date NOT NULL,
  body text NOT NULL,
  PRIMARY KEY (occurred_on,id)
) PARTITION BY RANGE (occurred_on);
CREATE TABLE db_partition.events_202601 PARTITION OF db_partition.events
  FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
CREATE TABLE db_partition.events_202602 PARTITION OF db_partition.events
  FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
INSERT INTO db_partition.events VALUES (1,'2026-01-31','enero'),(2,'2026-02-01','febrero');
EXPLAIN (COSTS OFF)
SELECT * FROM db_partition.events
WHERE occurred_on>='2026-02-01' AND occurred_on<'2026-03-01';
SELECT tableoid::regclass, * FROM db_partition.events ORDER BY occurred_on;
```

El 1 de febrero pertenece a febrero, no a enero. `tableoid::regclass` muestra la tabla física de cada fila. Las pruebas verifican ese límite para evitar un error que con datos de mitad de mes pasaría inadvertido.

Usamos `date` para centrarnos en límites de días. Con **timestamptz**, define si los rangos representan UTC o una zona de negocio y comprueba cambios de horario. «Un mes» debe tener una definición antes de convertirse en DDL.

## Pruning descarta particiones; un índice busca dentro

**Partition pruning** elimina del plan o de la ejecución particiones incompatibles con el predicado. Para febrero no necesitamos leer enero. El plan del ejemplo permite comprobarlo sin usar tiempos irrelevantes de una tabla de dos filas.

Eso no sustituye al índice dentro de la partición. Una partición mensual puede seguir conteniendo millones de registros. Si filtras además por cliente, necesitarás valorar accesos y distribución dentro de ella.

Conviene expresar rangos que el planner pueda relacionar con la clave. Transformaciones sobre la columna y consultas que omiten por completo esa clave pueden dificultar o impedir el descarte esperado. Observa el plan real. [Particionado declarativo](https://www.postgresql.org/docs/18/ddl-partitioning.html).

## La unicidad cambia cuando la clave atraviesa particiones

La primary key del ejemplo contiene `occurred_on`. PostgreSQL exige incluir las columnas de la clave de particionado en las constraints únicas aplicables a esta tabla particionada para poder respaldarlas con los índices de las particiones.

Por tanto, `(occurred_on,id)` no garantiza unicidad global de `id` por sí solo. Si la aplicación necesita esa propiedad, diseñarla requiere otra decisión, no omitir el problema porque un UUID «casi nunca colisiona».

Las foreign keys y las consultas deben corresponder al identificador lógico que realmente garantizas. No cambies una clave solo para que el DDL compile sin revisar a sus consumidores.

## Retirar datos no es lo mismo que borrarlos

Archivo: sesión `psql`, separar enero después de ejecutar el setup.

```sql
ALTER TABLE db_partition.events
DETACH PARTITION db_partition.events_202601;
SELECT count(*) FROM db_partition.events;
SELECT count(*) FROM db_partition.events_202601;
```

La tabla padre contiene ahora una fila y la tabla separada conserva otra. **DETACH** no ha borrado enero: ha dejado de formar parte del conjunto lógico.

Podrías archivar, verificar una copia y eliminar posteriormente esa tabla según una política explícita. La separación tiene requisitos y locks; la variante `CONCURRENTLY` tiene restricciones adicionales. No la presentes como una operación sin impacto sobre cualquier sistema activo.

Planifica la creación de futuras particiones. En este laboratorio insertar marzo falla porque no existe una partición compatible. Una partición **DEFAULT** puede capturar casos no previstos, pero también esconder que la automatización dejó de crear rangos a tiempo.

## OLTP y OLAP plantean necesidades diferentes

**OLTP** suele referirse a operaciones de negocio pequeñas y concurrentes. **OLAP** se orienta al análisis de conjuntos grandes. Una tabla particionada no se transforma automáticamente en un motor analítico ni resuelve una consulta que agrega toda la historia.

Retener datos operativos, archivar documentos y conservar información para analítica pueden requerir políticas distintas. Define quién puede consultar el archivo, cómo recuperarlo y qué datos ya no deben mantenerse. La retención es una decisión de producto y operación, no únicamente una fecha en un script.

## Código del artículo

Consulta los [archivos y pruebas de este post](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/db-partitioning/README.md). Clona el repositorio y ejecuta los comandos del artículo desde este paquete:

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples/packages/database-fundamentals
```

## Garantías y límites

Los rangos enrutan filas y permiten descartar particiones cuando el predicado lo permite. No garantizan aceleración general ni disponibilidad automática. Este ejemplo verifica enrutamiento, rechazo fuera de rango y conservación tras detach; no mide rendimiento a gran escala.

Antes de particionar, compara una tabla con buenos índices y retención controlada. Si esa solución cumple los requisitos, introduce menos mantenimiento. Si eliges particionar, ensaya también datos atrasados y consultas históricas.

## Ejercicio: marzo y un evento tardío

Crea marzo, inserta un evento de su primer día y verifica dónde queda. Después separa enero e intenta insertar un evento tardío de enero: documenta si debe rechazarse, ir a cuarentena o reabrir el periodo.

Acepta el ejercicio cuando esa política no dependa de improvisar durante un incidente. El siguiente artículo aborda otra copia de datos con ciclo de vida propio: [Redis y caché](/posts/redis-cache-consistencia).

## Referencias

PostgreSQL 18, consultado el 17 de octubre de 2026: [particionado, pruning y límites de constraints](https://www.postgresql.org/docs/18/ddl-partitioning.html), [ALTER TABLE y DETACH](https://www.postgresql.org/docs/18/sql-altertable.html) y [bloqueos explícitos](https://www.postgresql.org/docs/18/explicit-locking.html).
