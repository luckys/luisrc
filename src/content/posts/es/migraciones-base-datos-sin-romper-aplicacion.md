---
id: DB-MIGRATIONS
title: 'Migraciones de base de datos: cambia el esquema sin romper las versiones anteriores'
published: 2026-10-17T00:09:00Z
locale: es
translationKey: database-compatible-migrations
slug: migraciones-base-datos-sin-romper-aplicacion
draft: true
status: draft
level: intermedio
prerequisites: [DB-MODEL, DB-TRANSACTIONS]
description: 'Aplica expand–migrate–contract a una columna obligatoria. Aprende a coordinar despliegues, backfills, validación, locks y rollback sin prometer cero interrupciones.'
author: 'Luis Ramírez Calle'
series: 'Fundamentos de bases de datos'
tags: ['postgresql', 'migraciones', 'despliegue', 'backend', 'compatibilidad']
---

Renombras una columna, despliegas la aplicación nueva y todo funciona en tu prueba local. En producción todavía queda una instancia antigua que intenta leer el nombre anterior. Durante unos minutos, el mismo endpoint responde o falla según quién reciba la petición.

Una **migration** no modifica solamente tablas. Cambia un contrato que pueden estar usando varias versiones de la aplicación, scripts, procesos batch e informes.

Con [modelado](/posts/modelado-relacional-integridad-datos) y [transacciones](/posts/transacciones-postgresql-ejemplos-practicos) como base, vamos a introducir una columna obligatoria mediante **expand–migrate–contract**. El objetivo es comprobar compatibilidad, separar migración de datos de despliegue y reconocer qué puede bloquear o hacer irreversible un cambio.

## Expand, migrate y contract resuelven tres problemas diferentes

**Expand** añade una estructura que permite convivir a las versiones. **Migrate** adapta escritores y datos existentes. **Contract** elimina lo antiguo cuando ya no tiene consumidores.

<img src="/assets/visuals/database-series/migraciones.svg" alt="Expand añade la columna compatible. Migrate introduce dual write, rellena datos y retira escritores antiguos. Contract valida las reglas y elimina la columna anterior cuando ya no se usa." width="618" height="714" loading="lazy" style="width:100%;height:auto" />

[Ampliar el recurso visual](/assets/visuals/database-series/migraciones.svg).

No son tres comandos que deban ejecutarse inmediatamente uno después del otro en producción. Entre ellos puede haber despliegues, verificación y un periodo de observación.

Queremos cambiar `profiles.name` por `display_name`. Renombrar directamente sería simple, pero incompatible con el código anterior. Añadir la nueva columna permite preparar la transición sin romper sus lecturas.

## Un laboratorio pequeño para ensayar la secuencia

[Consulta el laboratorio en GitHub](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/database-fundamentals/sql/10-migraciones.sql), entra en `database-fundamentals/` y ejecuta:

Archivo: terminal.

```bash
docker compose up -d --wait
docker compose exec -T postgres psql -X -U lab -d series_lab -v ON_ERROR_STOP=1 -f /lab/sql/10-migraciones.sql
```

Archivo: `database-fundamentals/sql/10-migraciones.sql`.

```sql
DROP SCHEMA IF EXISTS db_migration CASCADE;
CREATE SCHEMA db_migration;
CREATE TABLE db_migration.profiles (id integer PRIMARY KEY, name text NOT NULL);
INSERT INTO db_migration.profiles VALUES (1,'Ana');
-- Expand: sigue funcionando el INSERT de la versión antigua.
ALTER TABLE db_migration.profiles ADD COLUMN display_name text;
INSERT INTO db_migration.profiles(id,name) VALUES (2,'Luis');
-- Dual write: la aplicación nueva aún escribe ambas columnas.
UPDATE db_migration.profiles SET display_name=name WHERE display_name IS NULL;
-- Cierre de la ventana: todos los escritores antiguos ya se retiraron.
ALTER TABLE db_migration.profiles ADD CONSTRAINT display_name_present
  CHECK (display_name IS NOT NULL) NOT VALID;
ALTER TABLE db_migration.profiles VALIDATE CONSTRAINT display_name_present;
ALTER TABLE db_migration.profiles ALTER COLUMN display_name SET NOT NULL;
ALTER TABLE db_migration.profiles DROP CONSTRAINT display_name_present;
-- Contract: solo tras verificar que ninguna versión lee name.
ALTER TABLE db_migration.profiles DROP COLUMN name;
SELECT * FROM db_migration.profiles ORDER BY id;
```

El script comprime la secuencia para poder ejecutarla con dos filas. **No simula un rolling deployment real**. El `INSERT` de Luis representa una escritura antigua mientras la columna nueva todavía permite nulos. Las pruebas comprueban el estado final y el rechazo de nuevos nulos.

No lo copies como una migración monolítica de producción: los comentarios señalan puntos en los que allí tendrías que detenerte y comprobar precondiciones.

## Dual write y backfill necesitan coordinarse

Tras expandir, despliega una versión que lea `COALESCE(display_name,name)` y escriba ambos campos en la misma transacción. Es un **dual write dentro de una base de datos**, no dos commits independientes contra servicios distintos.

Mientras sigan existiendo escritores antiguos que actualizan solo `name`, `display_name` puede quedar desactualizado. Para este renombrado sencillo, mantén `name` como fuente de verdad hasta retirar esos escritores. Después reconcilia ambas columnas y cambia las lecturas. Una alternativa es un trigger temporal cuidadosamente probado; evita una sincronización ambigua en ambas direcciones.

El **backfill** rellena registros existentes. Con dos filas basta un `UPDATE`; con millones puede generar WAL, retención de versiones y locks durante demasiado tiempo. Trabaja por lotes con un cursor estable, confirma entre lotes y registra progreso para poder reanudar.

Una paginación por `OFFSET` sobre datos que cambian puede saltarse o repetir trabajo. Un rango de clave y una condición idempotente ofrecen un punto de partida más claro. Idempotente no significa correcto si sigues copiando desde una fuente que otro proceso modifica sin el protocolo acordado.

## NOT VALID no significa que la regla quede desactivada

Un `CHECK ... NOT VALID` evita inicialmente el examen completo de las filas antiguas, pero exige la regla a nuevas filas y actualizaciones. Por eso añadirlo mientras la versión antigua sigue insertando sin `display_name` podría romperla.

`VALIDATE CONSTRAINT` comprueba los registros previos con un modo de bloqueo diferente del usado para muchas alteraciones estructurales. Si ya hay un `CHECK` válido que demuestra ausencia de nulos, PostgreSQL puede evitar otro escaneo al aplicar `SET NOT NULL`. Eso **no elimina todos los locks**. [ALTER TABLE](https://www.postgresql.org/docs/18/sql-altertable.html).

En una migración real fija un `lock_timeout` corto y un plan de reintento controlado para no permanecer esperando detrás de una transacción larga. Revisa el lock específico de cada operación, no supongas que todos los `ALTER TABLE` se comportan igual.

## CREATE INDEX CONCURRENTLY tiene un contrato distinto

Crear un índice ordinario puede bloquear escrituras. **CREATE INDEX CONCURRENTLY** permite construirlo mientras continúan las modificaciones, con más trabajo y condiciones adicionales. No puede ejecutarse dentro de un bloque transaccional ordinario y puede dejar un índice inválido tras un fallo. [CREATE INDEX](https://www.postgresql.org/docs/18/sql-createindex.html).

Comprueba si tu herramienta de migraciones envuelve cada archivo en una transacción. No conviertas una instrucción incompatible en un problema operativo por ocultar ese detalle detrás del framework.

Versiona los archivos aplicados y conserva su historial. Editar una migración ya ejecutada no cambia mágicamente los servidores anteriores; normalmente necesitas otra migración que lleve su estado al nuevo destino.

## Código del artículo

Consulta los [archivos y pruebas de este post](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/db-migrations/README.md). Clona el repositorio y ejecuta los comandos del artículo desde este paquete:

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples/packages/database-fundamentals
```

## Garantías y límites

**Expand–migrate–contract** organiza compatibilidad, no garantiza downtime cero. El volumen, las transacciones activas, el almacenamiento, los consumidores desconocidos y el comportamiento de la aplicación siguen importando.

Un rollback de código puede ser viable durante la expansión si mantienes el contrato antiguo. Después de eliminar una columna, una migración inversa no recupera automáticamente sus datos. Los backups y los ensayos de restauración cumplen otro papel.

El laboratorio verifica SQL y precondiciones con datos ficticios; no mide el impacto de un backfill masivo ni prueba una flota de aplicaciones coexistiendo. Para un proyecto real, añade contratos de lectura y escritura de ambas versiones a la prueba de despliegue.

## Ejercicio: intenta cerrar la ventana demasiado pronto

Detén el script después de añadir la columna nueva. Añade el `CHECK NOT VALID` e intenta insertar como la versión antigua, omitiendo `display_name`. Debe rechazarse.

Después escribe las condiciones que exigirías antes de cada fase: consumidores retirados, divergencias cero, datos completos y posibilidad real de volver atrás. Con ese criterio, pasa a [particionado y retención](/posts/particionado-retencion-postgresql), que resuelve otro tipo de evolución.

## Referencias

PostgreSQL 18, consulta del 17 de octubre de 2026: [ALTER TABLE y validación](https://www.postgresql.org/docs/18/sql-altertable.html), [modificación de tablas](https://www.postgresql.org/docs/18/ddl-alter.html), [bloqueos](https://www.postgresql.org/docs/18/explicit-locking.html) y [CREATE INDEX CONCURRENTLY](https://www.postgresql.org/docs/18/sql-createindex.html).
