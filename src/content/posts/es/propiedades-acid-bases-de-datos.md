---
id: DB-ACID
title: 'Propiedades ACID: qué garantiza una base de datos y qué depende de tu código'
published: 2026-10-10
locale: es
translationKey: database-acid-properties
slug: propiedades-acid-bases-de-datos
draft: true
status: draft
level: intermedio
prerequisites: []
related: [DB-TRANSACTIONS]
last_verified: 2026-10-10
description: 'Comprende atomicidad, consistencia, aislamiento y durabilidad con diagramas y ejemplos SQL ejecutables: transferencias, inventario, lecturas concurrentes y documentos guardados.'
author: 'Luis Ramírez Calle'
series: 'Fundamentos de bases de datos'
tags: ['postgresql', 'acid', 'bases-de-datos', 'sql', 'backend', 'diseno-de-sistemas']
---

Una transferencia descuenta 25 euros de una cuenta y falla antes de abonarlos en la otra. Las dos consultas SQL son correctas por separado, pero el resultado de la operación está mal: faltan 25 euros.

Las propiedades **ACID** ayudan a razonar sobre estos fallos. También sirven para entender por qué envolver código en una transacción no basta para impedir un stock negativo ni para obtener lecturas idénticas en todas las situaciones.

Vamos a ver cada propiedad con un problema reconocible, un diagrama y un experimento en PostgreSQL. Los casos son ejemplos educativos de situaciones que aparecen en aplicaciones reales; las cuentas ficticias no constituyen un sistema bancario completo. Necesitas conocer `SELECT`, `UPDATE` y la creación básica de tablas. Para ejecutar los ejemplos, usaremos Docker Compose, sin instalar PostgreSQL en tu ordenador.

## Qué son las propiedades ACID

**ACID** reúne cuatro garantías, cuyos nombres en inglés forman el acrónimo: _Atomicity, Consistency, Isolation_ y _Durability_. Conviene distinguirlas al diseñar una operación:

<div class="overflow-x-auto" role="region" aria-label="Propiedades ACID y ejemplos" tabindex="0">

| Propiedad                    | Pregunta que responde                               | Ejemplo                                                             |
| ---------------------------- | --------------------------------------------------- | ------------------------------------------------------------------- |
| Atomicidad (_Atomicity_)     | ¿Se conserva una operación a medias?                | Descontar y abonar una transferencia juntos.                        |
| Consistencia (_Consistency_) | ¿El resultado respeta las reglas definidas?         | Impedir que el inventario termine en negativo.                      |
| Aislamiento (_Isolation_)    | ¿Cómo interactúan operaciones concurrentes?         | Controlar lo que ve un panel mientras otro usuario cambia un saldo. |
| Durabilidad (_Durability_)   | ¿Qué ocurre con lo confirmado después de una caída? | Recuperar un documento cuyo guardado ya fue confirmado.             |

</div>

Estas garantías se aplican a una **transacción** (_transaction_), una unidad de trabajo (_unit of work_) de la base de datos. Para agrupar varias sentencias en PostgreSQL, la delimitamos con `BEGIN` y terminamos con `COMMIT` si queremos conservar los cambios mediante una confirmación (_commit_), o `ROLLBACK` si queremos descartarlos (_rollback_).

Sin un bloque explícito, el cliente `psql` usado aquí opera con **confirmación automática** (_autocommit_): cada sentencia correcta queda confirmada por separado. Esa distinción explica nuestro primer fallo. [Referencia de BEGIN](https://www.postgresql.org/docs/18/sql-begin.html).

Aquí nos centraremos en las garantías. El artículo [Transacciones en PostgreSQL: BEGIN, COMMIT, ROLLBACK y SAVEPOINT](/posts/transacciones-postgresql-ejemplos-practicos) explica cómo delimitar el trabajo, tratar errores y trasladarlo a una aplicación.

## Prepara un laboratorio pequeño con Docker Compose

Puedes [descargar los archivos de ambos artículos](/assets/examples/transacciones-lab.zip), descomprimirlos y entrar en `transacciones/`. Si prefieres escribirlos, crea esa carpeta y su subcarpeta `sql/`, y copia los archivos de esta sección y de cada ejemplo.

Para esta parte solo necesitas Docker con Compose. El servidor queda accesible en `127.0.0.1:55434`; el cliente `psql` se ejecuta dentro del contenedor. La imagen fija versión y digest para reproducir el entorno. Las credenciales son públicas y ficticias, para esta base de datos local.

Archivo: `transacciones/docker-compose.yml`.

```yaml
name: luisrc-transactions-lab
services:
  postgres:
    image: postgres:18.4-alpine3.23@sha256:996d0920e4ff9df1fc19dacb904492f3c1ec0ec1cc338f0ad7123be7731c5f5e
    environment:
      POSTGRES_DB: transactions_lab
      POSTGRES_USER: lab
      # Credencial pública y ficticia, solo para este laboratorio local.
      POSTGRES_PASSWORD: local-lab-only
    ports:
      - '127.0.0.1:${TRANSACTIONS_DB_PORT:-55434}:5432'
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U lab -d transactions_lab']
      interval: 1s
      timeout: 3s
      retries: 30
```

La comprobación de salud (_health check_) permite esperar a que PostgreSQL acepte conexiones antes de lanzar consultas. No es una comprobación de las reglas de nuestra aplicación. [Inicio y dependencias en Compose](https://docs.docker.com/compose/how-tos/startup-order/).

Archivo: `transacciones/sql/setup.sql`.

```sql
CREATE SCHEMA IF NOT EXISTS concept_examples;
SET search_path TO concept_examples;

CREATE TABLE IF NOT EXISTS accounts (
  id integer PRIMARY KEY,
  balance_minor bigint NOT NULL CHECK (balance_minor >= 0)
);
CREATE TABLE IF NOT EXISTS inventory (
  sku text PRIMARY KEY,
  available integer NOT NULL CHECK (available >= 0)
);
CREATE TABLE IF NOT EXISTS documents (
  id integer PRIMARY KEY,
  body text NOT NULL
);

-- Reinicia únicamente las tablas ficticias de estos ejemplos.
TRUNCATE accounts, inventory, documents;
INSERT INTO accounts VALUES (1, 10000), (2, 5000);
INSERT INTO inventory VALUES ('T_SHIRT', 1);
INSERT INTO documents VALUES (1, 'draft');
```

Guardamos los saldos en céntimos: `10000` representa 100 euros. Así los ejemplos usan enteros y no introducen redondeos de coma flotante (_floating point_). El esquema (_schema_) `concept_examples` separa estas tablas ficticias de las del ejemplo de TypeScript.

Desde la carpeta `transacciones/`, ejecuta:

```bash
docker compose up -d --wait
docker compose exec -T postgres psql -U lab -d transactions_lab -v ON_ERROR_STOP=1 < sql/setup.sql
```

El setup **reinicia los datos de estas tres tablas de ejemplo**. Puedes repetirlo antes de cada experimento para volver a los mismos valores. Si el puerto está ocupado, fija `TRANSACTIONS_DB_PORT` a otro puerto al arrancar Compose; las consultas de este artículo siguen entrando por el contenedor.

## Atomicidad (Atomicity): una transferencia no debe quedarse a medias

El estado inicial contiene dos cuentas: A tiene 100 euros y B tiene 50. Queremos pasar 25 euros de A a B. La suma debe seguir siendo 150 euros.

Sin agrupar las escrituras, el débito puede quedar confirmado antes del crédito. Un fallo de aplicación, una desconexión o una consulta posterior que falle deja la operación incompleta. Reiniciar el proceso no revierte el débito ya confirmado.

<img src="/assets/visuals/database-fundamentals/atomicidad-transferencia.svg" alt="La transferencia empieza con 100 y 50 euros. Sin agrupar, un fallo después del débito deja 75 y 50. Con transacción, rollback mantiene 100 y 50, o commit confirma 75 y 75." width="974" height="835" loading="lazy" style="width:100%;height:auto" />

_Tres desenlaces del mismo caso. El total permite reconocer el estado parcial._

[Abrir el diagrama para ampliarlo](/assets/visuals/database-fundamentals/atomicidad-transferencia.svg).

Este archivo reproduce primero el problema, después el rollback y finalmente el recorrido correcto:

Archivo: `transacciones/sql/atomicity.sql`.

```sql
-- Los errores de división son intencionales: psql debe continuar.
\set ON_ERROR_STOP off
SET search_path TO concept_examples;

\echo 'Without an explicit transaction: the first write is already committed'
UPDATE accounts SET balance_minor = balance_minor - 2500 WHERE id = 1;
SELECT 1 / 0;
SELECT * FROM accounts ORDER BY id;
SELECT sum(balance_minor) AS total_minor FROM accounts;

-- Restablece el estado inicial del ejemplo.
UPDATE accounts SET balance_minor = CASE id WHEN 1 THEN 10000 ELSE 5000 END;

\echo 'With a transaction: the failure rolls back the debit'
BEGIN;
UPDATE accounts SET balance_minor = balance_minor - 2500 WHERE id = 1;
SELECT 1 / 0;
ROLLBACK;
SELECT * FROM accounts ORDER BY id;

\echo 'Successful path: debit and credit are committed together'
BEGIN;
UPDATE accounts SET balance_minor = balance_minor - 2500 WHERE id = 1;
UPDATE accounts SET balance_minor = balance_minor + 2500 WHERE id = 2;
COMMIT;
SELECT * FROM accounts ORDER BY id;
SELECT sum(balance_minor) AS total_minor FROM accounts;
```

```bash
docker compose exec -T postgres psql -U lab -d transactions_lab < sql/atomicity.sql
```

`SELECT 1 / 0` provoca un error SQL deliberado. `ON_ERROR_STOP off` permite que `psql` continúe el archivo para mostrar las consultas posteriores; es una elección del experimento, no una recomendación para ejecutar migraciones.

Los tres resultados que debes observar son:

<div class="overflow-x-auto" role="region" aria-label="Saldos observados en los recorridos de atomicidad" tabindex="0">

| Recorrido              | Cuenta A | Cuenta B | Total |
| ---------------------- | -------: | -------: | ----: |
| Autocommit y fallo     |     7500 |     5000 | 12500 |
| Transacción y rollback |    10000 |     5000 | 15000 |
| Transacción completa   |     7500 |     7500 | 15000 |

</div>

**Atomicidad** (_atomicity_) significa que los cambios de la unidad transaccional se confirman juntos o se descartan; decimos que la operación es **atómica** (_atomic_). En el segundo recorrido, el débito estaba dentro del bloque que deshicimos. En el primero, ya pertenecía a una transacción confirmada. [ROLLBACK](https://www.postgresql.org/docs/18/sql-rollback.html).

### Dónde aparece este problema en aplicaciones reales

La misma situación ocurre al crear una factura y sus líneas, registrar una inscripción y ocupar una plaza, o guardar un pedido y sus detalles. Si la operación exige que existan juntos, un error entre las escrituras no debería dejar un objeto incompleto.

La frontera depende de esa regla de negocio. Guardar un pedido y llamar a una API de correo no convierte el envío en transaccional: PostgreSQL no controla ese servicio externo. Un rollback no puede retirar un correo enviado.

Tampoco basta con que las consultas sean correctas sintácticamente. Si el crédito utiliza un identificador inexistente, un `UPDATE` puede afectar a cero filas sin lanzar una excepción. La aplicación debe verificar cuántas filas cambió y decidir si la operación puede confirmarse. Atomicidad conserva o descarta **el trabajo que realmente has definido**.

## Consistencia (Consistency): las reglas deben estar expresadas

Ahora imagina una tienda con una camiseta disponible. Una petición intenta reservar dos. Si la actualización deja el stock en `-1`, la operación puede ser atómica y seguir siendo incorrecta.

La **consistencia** (_consistency_) se refiere a mantener las reglas del estado válido. Algunas se pueden expresar en la base de datos: unicidad (_uniqueness_), referencias entre tablas, valores obligatorios o restricciones (_constraints_) sobre columnas. Otras requieren lógica de negocio (_business logic_) y un tratamiento correcto de la concurrencia (_concurrency_).

En nuestra tabla, `CHECK (available >= 0)` declara explícitamente que el stock negativo es inválido. PostgreSQL rechaza una escritura que lo incumpla. [Restricciones de datos](https://www.postgresql.org/docs/18/ddl-constraints.html).

<img src="/assets/visuals/database-fundamentals/consistencia-inventario.svg" alt="La tienda intenta descontar dos camisetas cuando queda una. PostgreSQL calcula menos uno, rechaza la escritura por CHECK y, tras rollback, el inventario sigue en una unidad." width="892" height="1366" loading="lazy" style="width:100%;height:auto" />

_La base de datos puede exigir la regla porque el esquema la contiene._

[Abrir el diagrama para ampliarlo](/assets/visuals/database-fundamentals/consistencia-inventario.svg).

Vuelve al setup y ejecuta este archivo:

Archivo: `transacciones/sql/consistency.sql`.

```sql
\set ON_ERROR_STOP off
SET search_path TO concept_examples;

BEGIN;
UPDATE inventory SET available = available - 2 WHERE sku = 'T_SHIRT';
-- El CHECK rechaza -1. El COMMIT de este bloque abortado devuelve ROLLBACK.
COMMIT;
SELECT * FROM inventory;
```

```bash
docker compose exec -T postgres psql -U lab -d transactions_lab -v ON_ERROR_STOP=1 < sql/setup.sql
docker compose exec -T postgres psql -U lab -d transactions_lab < sql/consistency.sql
```

La actualización falla con SQLSTATE `23514`, una violación de `CHECK`. El bloque queda abortado y su `COMMIT` devuelve `ROLLBACK`. La consulta final sigue mostrando una unidad. El artículo de transacciones explica por qué un `COMMIT` escrito en el código no siempre implica una confirmación.

### Qué no sabe la base de datos por sí sola

El esquema de las cuentas impide saldos negativos, pero **no declara que una transferencia deba conservar la suma de las dos cuentas**. Si olvidamos el crédito y confirmamos solo el débito, los dos saldos cumplen el `CHECK` y la base de datos acepta la operación.

Por eso, una transacción no demuestra que el algoritmo sea correcto. Tienes que definir los invariantes (_invariants_), programar las operaciones que los preservan y probar los recorridos relevantes.

En una tienda, también puedes hacer una reserva con una actualización condicional:

```sql
SET search_path TO concept_examples;
UPDATE inventory
SET available = available - 2
WHERE sku = 'T_SHIRT' AND available >= 2
RETURNING available;
```

Con el setup inicial, devuelve cero filas y el stock queda en uno. Ese resultado significa que la reserva no se hizo; la aplicación debe comunicarlo. Si además debe crear una fila de reserva, agrupa ambos pasos y confirma solo cuando se haya descontado la cantidad necesaria.

La consistencia de ACID trata de las reglas del estado de datos. No debe confundirse con las garantías de lectura entre réplicas de un sistema distribuido.

## Aislamiento (Isolation): dos lecturas pueden ver estados distintos

Imagina un panel que consulta un saldo, realiza otra tarea y vuelve a consultarlo. Mientras tanto, otro usuario añade 5 euros. ¿Deben coincidir ambas lecturas?

El **aislamiento** (_isolation_) define cómo interactúan transacciones concurrentes y qué cambios pueden observar. En PostgreSQL, `READ COMMITTED` (lectura confirmada) es el nivel predeterminado: cada consulta ordinaria obtiene una instantánea (_snapshot_) de los datos confirmados al comenzar esa consulta. Dos `SELECT` de la misma transacción pueden ver valores distintos. Eso se llama **lectura no repetible** (_non-repeatable read_). [Niveles de aislamiento](https://www.postgresql.org/docs/18/transaction-iso.html).

<img src="/assets/visuals/database-fundamentals/aislamiento-lecturas.svg" alt="La sesión A lee 100 euros en READ COMMITTED. La sesión B añade cinco y confirma. Una segunda consulta de A ve 105. Con REPEATABLE READ, A seguiría viendo 100." width="1088" height="1157" loading="lazy" style="width:100%;height:auto" />

_No hay lectura de datos sin confirmar. Cambia la instantánea entre consultas._

[Abrir el diagrama para ampliarlo](/assets/visuals/database-fundamentals/aislamiento-lecturas.svg).

El lector abre una transacción y espera entre las dos consultas:

Archivo: `transacciones/sql/isolation-reader.sql`.

```sql
SET search_path TO concept_examples;
BEGIN ISOLATION LEVEL :isolation_level;
SELECT balance_minor FROM accounts WHERE id = 1;
\prompt 'Run the writer in terminal B, then press Enter: ' resume
SELECT balance_minor FROM accounts WHERE id = 1;
COMMIT;
```

El escritor actualiza el saldo en otra sesión:

Archivo: `transacciones/sql/isolation-writer.sql`.

```sql
SET search_path TO concept_examples;
BEGIN;
UPDATE accounts SET balance_minor = balance_minor + 500 WHERE id = 1;
COMMIT;
SELECT balance_minor FROM accounts WHERE id = 1;
```

Reinicia los datos y copia el lector al contenedor para poder ejecutarlo con una entrada interactiva. En la **terminal A**:

```bash
docker compose exec -T postgres psql -U lab -d transactions_lab -v ON_ERROR_STOP=1 < sql/setup.sql
docker compose cp sql/isolation-reader.sql postgres:/tmp/isolation-reader.sql
docker compose exec postgres psql -U lab -d transactions_lab -v ON_ERROR_STOP=1 -v isolation_level='READ COMMITTED' -f /tmp/isolation-reader.sql
```

El lector muestra `10000` y se detiene en el mensaje que pide ejecutar al escritor. Deja esa terminal abierta sin pulsar Enter todavía.

En la **terminal B**, ejecuta:

```bash
docker compose exec -T postgres psql -U lab -d transactions_lab -v ON_ERROR_STOP=1 < sql/isolation-writer.sql
```

Regresa a A y pulsa Enter. El archivo ejecuta el segundo `SELECT` y después `COMMIT;`. La primera lectura muestra `10000` y la segunda `10500`.

Para repetir el experimento con otro nivel, ejecuta el setup después de terminar A y repite el comando del lector cambiando `isolation_level='READ COMMITTED'` por `isolation_level='REPEATABLE READ'`. Vuelve a ejecutar al escritor cuando el lector lo pida. La primera consulta fija la instantánea de esa transacción; la segunda sigue viendo `10000`, aunque B ya haya confirmado `10500`.

### Cuándo importa el nivel de aislamiento

Esto aparece en informes con varias consultas que deben describir el mismo momento, en cálculos que leen y después escriben, o en reservas concurrentes sobre un recurso escaso.

`REPEATABLE READ` (lectura repetible) estabiliza la visión del lector, pero no hace correctas todas las reglas entre varias filas. `SERIALIZABLE` (serializable) puede detectar ejecuciones que no equivalen a un orden secuencial y abortar una transacción; la aplicación debe poder reintentar (_retry_) **la unidad completa** cuando corresponda. La garantía de equivalencia a ese orden se llama serializabilidad (_serializability_).

Los bloqueos de filas (_row locks_), las actualizaciones condicionales (_conditional updates_) y las restricciones también forman parte de la solución. Elegir un nivel más estricto tiene costes y puede exigir reintentos. No existe una elección universal para todos los casos. [Detalles de REPEATABLE READ](https://www.postgresql.org/docs/18/transaction-iso.html#XACT-REPEATABLE-READ), [SERIALIZABLE](https://www.postgresql.org/docs/18/transaction-iso.html#XACT-SERIALIZABLE).

## Durabilidad (Durability): qué significa que el guardado fue confirmado

Un editor muestra «guardado» después de recibir la confirmación del commit. Un instante después cae el servidor. Al volver a abrir el documento, esperamos encontrar la versión confirmada.

La **durabilidad** (_durability_) es la garantía de conservar lo confirmado frente a los fallos cubiertos por el sistema y su configuración.

PostgreSQL utiliza **registro de escritura anticipada** (_Write-Ahead Logging_, o WAL). Registra información para recuperar los cambios antes de escribir las páginas de datos correspondientes. La recuperación (_recovery_) puede reproducir esos registros si los cambios todavía no estaban en los archivos de tablas. Confirmar no exige escribir de inmediato cada página modificada. [Cómo funciona WAL](https://www.postgresql.org/docs/18/wal-intro.html).

<img src="/assets/visuals/database-fundamentals/durabilidad-wal.svg" alt="Los cambios generan WAL. Con fsync y synchronous_commit activados, la confirmación espera la persistencia local de WAL. Tras una caída, PostgreSQL puede recuperar cambios usando el registro." width="824" height="1246" loading="lazy" style="width:100%;height:auto" />

_Flujo conceptual de persistencia local; no representa una prueba de corte eléctrico ni una réplica._

[Abrir el diagrama para ampliarlo](/assets/visuals/database-fundamentals/durabilidad-wal.svg).

Reinicia los datos y guarda un documento:

Archivo: `transacciones/sql/durability.sql`.

```sql
SET search_path TO concept_examples;
BEGIN;
UPDATE documents SET body = 'committed version' WHERE id = 1;
COMMIT;
SELECT * FROM documents;
SHOW fsync;
SHOW synchronous_commit;
SHOW full_page_writes;
```

```bash
docker compose exec -T postgres psql -U lab -d transactions_lab -v ON_ERROR_STOP=1 < sql/setup.sql
docker compose exec -T postgres psql -U lab -d transactions_lab -v ON_ERROR_STOP=1 < sql/durability.sql
docker compose restart postgres
docker compose up -d --wait
docker compose exec -T postgres psql -U lab -d transactions_lab -c "SELECT * FROM concept_examples.documents;"
```

En este laboratorio, `fsync`, `synchronous_commit` y `full_page_writes` están en `on`. El documento sigue mostrando `committed version` después del reinicio.

**Esta prueba comprueba persistencia tras un reinicio ordenado.** No demuestra por sí sola recuperación ante un corte eléctrico ni tolerancia a perder el disco. El diagrama explica el mecanismo; el experimento tiene un alcance más limitado.

### Qué debes revisar en un sistema real

Con `synchronous_commit = on`, la confirmación espera el WAL local persistido. Desactivarlo puede permitir perder commits recientes tras una caída. Desactivar `fsync` puede comprometer la integridad de la base de datos. También dependes de que el almacenamiento respete las operaciones de persistencia. [Configuración de WAL](https://www.postgresql.org/docs/18/runtime-config-wal.html), [fiabilidad del almacenamiento](https://www.postgresql.org/docs/18/wal-reliability.html).

La durabilidad tampoco sustituye a las copias de seguridad (_backups_): una eliminación confirmada puede ser perfectamente durable y, aun así, un error que quieras recuperar.

## Cómo aplicar ACID al diseñar una operación

Antes de implementar una operación con varias escrituras, formula estas preguntas con datos concretos:

1. **Qué debe confirmarse junto.** Por ejemplo, la factura y sus líneas.
2. **Qué estados son inválidos.** Stock negativo, referencias inexistentes, identificadores duplicados.
3. **Quién puede cambiar los datos a la vez.** Qué lecturas deben conservar la misma visión y qué conflictos hay que resolver.
4. **Qué confirmación necesita el usuario.** Qué persistencia ofrece la configuración y qué recuperación requiere el negocio.
5. **Qué efectos salen de la base de datos.** Correos, archivos en otro servicio o llamadas HTTP necesitan coordinación adicional.

## Preguntas habituales sobre ACID

### ¿Una transacción impide cualquier dato incorrecto?

No. Agrupa los cambios, pero las reglas deben estar modeladas y el código debe aplicarlas. Nuestro débito sin crédito puede incumplir la regla del ejemplo sin violar ninguna restricción de columnas.

### ¿Usar BEGIN evita que cambie lo que leo?

Depende del aislamiento. En `READ COMMITTED`, los dos `SELECT` pueden ver commits distintos. El ejemplo de dos terminales permite observarlo.

### ¿ROLLBACK revierte un COMMIT anterior?

No. Descartas trabajo pendiente de esa transacción. Corregir una operación confirmada requiere otra operación, con sus reglas y sus comprobaciones.

Cuando termines, elimina **el contenedor y los volúmenes de este laboratorio local**:

```bash
docker compose down --volumes
```

Para seguir practicando, pasa a [Transacciones en PostgreSQL: BEGIN, COMMIT, ROLLBACK y SAVEPOINT](/posts/transacciones-postgresql-ejemplos-practicos). Allí veremos qué hacer cuando un error SQL deja el bloque abortado y cómo conservar una parte del trabajo con un savepoint.
