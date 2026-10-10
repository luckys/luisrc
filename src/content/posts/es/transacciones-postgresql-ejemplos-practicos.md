---
id: DB-TRANSACTIONS
title: 'Transacciones en PostgreSQL: BEGIN, COMMIT, ROLLBACK y SAVEPOINT con ejemplos'
published: 2026-10-10T00:01:00Z
locale: es
translationKey: postgresql-transactions-practical-examples
slug: transacciones-postgresql-ejemplos-practicos
draft: true
status: draft
level: intermedio
prerequisites: [DB-ACID]
related: [DB-ACID]
last_verified: 2026-10-10
description: 'Aprende a delimitar transacciones, tratar errores SQL y usar SAVEPOINT con Docker Compose. Incluye diagramas, casos de aplicación y una ampliación ejecutable con TypeScript y Vitest.'
author: 'Luis Ramírez Calle'
series: 'Fundamentos de bases de datos'
tags: ['postgresql', 'transacciones', 'sql', 'typescript', 'docker', 'backend', 'testing']
---

Tu código ejecuta dos escrituras y devuelve un error si la segunda falla. Eso no dice qué ocurrió con la primera. Para responder, necesitas saber dónde empieza la transacción, qué sesión la ejecuta y cómo termina.

Vamos a practicar `BEGIN`, `COMMIT`, `ROLLBACK` y `SAVEPOINT` con PostgreSQL. Primero con SQL (_Structured Query Language_, lenguaje de consulta estructurado), para ver el comportamiento sin que lo oculte una capa de mapeo objeto-relacional (ORM, _Object-Relational Mapping_). Después encontrarás una ampliación opcional con todo el código de una aplicación TypeScript y nueve pruebas de integración (_integration tests_).

Si necesitas repasar qué garantizan estas operaciones, empieza por [Propiedades ACID](/posts/propiedades-acid-bases-de-datos). Allí reproducimos los fallos con transferencias, inventario y lectores concurrentes.

## Qué es una transacción y cómo elegir su frontera

Una **transacción** (_transaction_) delimita una unidad de trabajo (_unit of work_) que quieres confirmar o descartar conjuntamente. La frontera transaccional (_transaction boundary_) se elige por lo que debe quedar válido al terminar, no por cuántas líneas tiene una función.

Por ejemplo, al emitir una factura podrías necesitar guardar la cabecera y todas sus líneas. Confirmar solo la cabecera deja un objeto que la aplicación quizá no pueda utilizar. En una reserva, descontar una plaza y crear la inscripción también pueden formar una sola operación.

Una petición HTTP puede necesitar una transacción, varias o ninguna transacción explícita. Tampoco una función asíncrona ni una llamada a `Promise.all` agrupa por sí sola las escrituras de PostgreSQL.

## Prepara PostgreSQL y los datos del ejemplo

[Descarga el laboratorio completo](/assets/examples/transacciones-lab.zip) y entra en la carpeta `transacciones/`. Si lo construyes manualmente, crea esa carpeta y `sql/`, y copia los dos archivos siguientes. Solo necesitas Docker con Compose para las secciones de SQL.

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

El puerto del host queda limitado a `127.0.0.1`. Estas credenciales ficticias pertenecen únicamente al laboratorio. El tag y el digest fijan el servidor utilizado en las comprobaciones.

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

```bash
docker compose up -d --wait
docker compose exec -T postgres psql -U lab -d transactions_lab -v ON_ERROR_STOP=1 < sql/setup.sql
docker compose exec postgres psql -U lab -d transactions_lab
```

El último comando abre una sesión interactiva. Los ejemplos siguientes se ejecutan dentro de esa sesión. El setup restablece las tablas de demostración: hazlo solo en este laboratorio y con las otras transacciones ya cerradas.

## Confirmación automática (Autocommit): varias sentencias correctas no forman una sola operación

En el `psql` de este ejemplo, una sentencia exitosa fuera de un bloque explícito se confirma individualmente. Si ejecutas un débito y luego falla el crédito, el primer cambio ya está guardado. [Autocommit y BEGIN](https://www.postgresql.org/docs/18/sql-begin.html).

El mismo problema aparece en la ampliación TypeScript: primero insertamos un pedido y después su **registro interno de pago**. Crear ese registro no cobra dinero ni llama a un proveedor.

<img src="/assets/visuals/database-fundamentals/escrituras-independientes.svg" alt="La aplicación inserta un pedido que PostgreSQL confirma. La aplicación falla antes de insertar su pago interno. Otra sesión ve un pedido sin pago; un rollback posterior no deshace el commit anterior." width="1132" height="1366" loading="lazy" style="width:100%;height:auto" />

_Una clave foránea (*foreign key*) obliga al pago a tener pedido, pero no obliga a cada pedido a tener pago._

[Abrir el diagrama para ampliarlo](/assets/visuals/database-fundamentals/escrituras-independientes.svg).

Para evitar el estado parcial, ambas escrituras deben pertenecer al mismo bloque y a la misma sesión. Esa sesión conserva el contexto transaccional.

## BEGIN y COMMIT: confirmar dos cambios juntos

`BEGIN` inicia el bloque; `COMMIT` solicita su confirmación (_commit_). En la sesión interactiva, ejecuta:

```sql
SET search_path TO concept_examples;
BEGIN;
UPDATE accounts SET balance_minor = balance_minor - 2500 WHERE id = 1;
UPDATE accounts SET balance_minor = balance_minor + 2500 WHERE id = 2;
SELECT * FROM accounts ORDER BY id;
COMMIT;
```

Partiendo del setup, la sesión ve `7500` y `7500` antes de confirmar: una transacción puede leer sus propias escrituras. Otra sesión todavía ve los datos anteriores mientras el bloque está abierto. Una nueva consulta en `READ COMMITTED` podrá ver los cambios después del commit.

<img src="/assets/visuals/database-fundamentals/transaccion-atomica.svg" alt="Dentro del bloque se inserta un pedido. Otro lector no lo ve aún. Si falla la aplicación, rollback deja cero pedidos y pagos. En el recorrido alternativo se inserta el pago y commit permite ver ambos." width="1084" height="1632" loading="lazy" style="width:100%;height:auto" />

_Dos recorridos alternativos: descartar trabajo pendiente o confirmar la unidad completa._

[Abrir el diagrama para ampliarlo](/assets/visuals/database-fundamentals/transaccion-atomica.svg).

En una aplicación debes verificar el resultado de cada paso. Un `UPDATE` que afecta cero filas no es un error SQL: si debías modificar exactamente una cuenta, ese resultado exige decidir qué hacer antes de confirmar.

`COMMIT` termina el bloque; no puedes deshacerlo después con `ROLLBACK`. Corregir una transferencia ya confirmada requiere otra operación de negocio, que puede ser una reversión con su propio registro. [COMMIT](https://www.postgresql.org/docs/18/sql-commit.html).

## Descartar cambios (Rollback): trabajo que aún no está confirmado

Tras la transferencia anterior, ejecuta:

```sql
BEGIN;
UPDATE documents SET body = 'discarded change' WHERE id = 1;
SELECT * FROM documents;
ROLLBACK;
SELECT * FROM documents;
```

La primera consulta muestra el cambio pendiente en esta sesión. Después del rollback, vuelve a aparecer `draft`, el valor inicial. [ROLLBACK](https://www.postgresql.org/docs/18/sql-rollback.html).

Este recorrido también sirve cuando la decisión de cancelar viene de la aplicación. Si una validación posterior falla, tu código debe terminar el bloque correctamente; PostgreSQL no recibe automáticamente las excepciones de JavaScript.

## Un error SQL puede dejar la transacción abortada

Prueba este bloque en la misma sesión:

```sql
BEGIN;
SELECT 1 / 0;
SELECT * FROM documents;
COMMIT;
```

La división devuelve SQLSTATE `22012`. El siguiente `SELECT` falla con `25P02`: el bloque ya está en estado de transacción abortada (_aborted transaction_). El `COMMIT` final devuelve el comando `ROLLBACK` y descarta el trabajo.

**Haber enviado COMMIT no prueba que se haya confirmado nada.** El cliente tiene que detectar los fallos anteriores. Un driver puede resolver la consulta final y devolver `command: 'ROLLBACK'`; no debes ignorar errores de sentencias anteriores ni convertir el final en éxito. [Estados del protocolo](https://www.postgresql.org/docs/18/protocol-flow.html).

Si necesitas abandonar todo el trabajo, envía `ROLLBACK`. Si habías definido un savepoint adecuado antes del fallo, puedes recuperarte hasta ese punto.

## SAVEPOINT: recuperar una parte sin perder la anterior

Un **punto de recuperación** (_savepoint_) marca un punto dentro de una transacción. Volver a él descarta los cambios posteriores y permite continuar cuando un error SQL ha abortado el bloque. Liberarlo elimina ese punto; **no confirma el trabajo exterior**. [SAVEPOINT](https://www.postgresql.org/docs/18/sql-savepoint.html), [ROLLBACK TO SAVEPOINT](https://www.postgresql.org/docs/18/sql-rollback-to.html).

<img src="/assets/visuals/database-fundamentals/savepoint.svg" alt="BEGIN agrupa débito y crédito. Un savepoint precede al trabajo opcional que falla. Rollback hasta el savepoint conserva el trabajo principal. Release elimina el punto y commit confirma al final." width="681" height="1298" loading="lazy" style="width:100%;height:auto" />

_El fallo opcional se puede recuperar porque dejamos un punto antes de ejecutarlo._

[Abrir el diagrama para ampliarlo](/assets/visuals/database-fundamentals/savepoint.svg).

Este archivo contiene el recorrido completo. Cierra la sesión interactiva con `\q` y reinicia los datos antes de ejecutarlo:

Archivo: `transacciones/sql/transactions.sql`.

```sql
-- Este archivo incluye un error deliberado para practicar SAVEPOINT.
\set ON_ERROR_STOP off
SET search_path TO concept_examples;

BEGIN;
UPDATE accounts SET balance_minor = balance_minor - 2500 WHERE id = 1;
UPDATE accounts SET balance_minor = balance_minor + 2500 WHERE id = 2;

SAVEPOINT optional_work;
SELECT 1 / 0;
ROLLBACK TO SAVEPOINT optional_work;
RELEASE SAVEPOINT optional_work;

COMMIT;
SELECT * FROM accounts ORDER BY id;

BEGIN;
UPDATE documents SET body = 'discarded change' WHERE id = 1;
ROLLBACK;
SELECT * FROM documents;
```

```bash
docker compose exec -T postgres psql -U lab -d transactions_lab -v ON_ERROR_STOP=1 < sql/setup.sql
docker compose exec -T postgres psql -U lab -d transactions_lab < sql/transactions.sql
```

El archivo continúa tras la división deliberada gracias a `ON_ERROR_STOP off`. Los saldos finales son `7500` y `7500`. El documento permanece en `draft` porque su segundo bloque se descarta.

### Un uso realista de savepoints

En una importación por lotes, podrías conservar las filas válidas y descartar una fila que incumple una regla, si el negocio acepta una importación parcial. Cada intento puede tener su savepoint, y el resultado debe informar qué filas no se importaron.

Esa decisión sería incorrecta si el lote debe aceptarse entero o rechazarse entero. Tampoco debes usar un savepoint para ignorar el error de una parte obligatoria, como el crédito de nuestra transferencia.

La división del archivo es una inyección de fallo fácil de reproducir. El diagrama describe la mecánica de recuperación, no propone un cálculo opcional concreto para una transferencia real.

## Errores de SQL, de aplicación y de conexión requieren respuestas distintas

<div class="overflow-x-auto" role="region" aria-label="Respuestas a errores de transacción" tabindex="0">

| Situación                             | Qué sabe el sistema                                       | Qué debe hacer la aplicación                                        |
| ------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------- |
| Error de aplicación antes del commit  | La sesión puede seguir teniendo un bloque abierto.        | Enviar rollback y propagar el fallo.                                |
| Error SQL dentro del bloque           | El bloque puede quedar abortado.                          | Rollback completo o recuperación a un savepoint previsto.           |
| Desconexión antes de enviar commit    | La sesión no confirmó ese bloque.                         | PostgreSQL lo descarta cuando detecta el cierre; no devolver éxito. |
| Conexión perdida al esperar el commit | El commit pudo ejecutarse aunque no llegase la respuesta. | Tratar el resultado como incierto y reconciliarlo antes de repetir. |

</div>

El último caso es una confirmación de resultado incierto (_unknown commit outcome_) e importa al guardar compras, movimientos o inscripciones. Repetir a ciegas después de un error de red puede duplicar una operación ya confirmada. Necesitas una forma de identificar la operación y consultar su resultado. El ejemplo TypeScript no implementa esa reconciliación (_reconciliation_) ni afirma resolverla.

Una transacción local tampoco incluye automáticamente un cobro HTTP, un correo o un archivo escrito en otro servicio. Mantener una llamada lenta dentro del bloque prolonga el uso de la conexión y los bloqueos, y un rollback no deshace sus efectos externos.

<img src="/assets/visuals/database-fundamentals/frontera-servicio-externo.svg" alt="La aplicación abre una transacción local y solicita un correo a otro servicio. El correo se envía, pero la aplicación falla y revierte PostgreSQL. El mensaje sigue enviado porque el servicio externo no participa en el rollback." width="1103" height="1198" loading="lazy" style="width:100%;height:auto" />

_El estado local se deshace; el correo ya enviado requiere una estrategia distinta de coordinación._

[Abrir el diagrama para ampliarlo](/assets/visuals/database-fundamentals/frontera-servicio-externo.svg).

## Llevarlo a una aplicación: usa una sola conexión

Con `node-postgres`, debes obtener un cliente del conjunto de conexiones (_connection pool_) y ejecutar **todas** las sentencias del bloque en ese cliente. Varias llamadas a `pool.query` pueden usar conexiones distintas; no permiten asumir una sesión común. Al terminar, libera el cliente. [Transacciones con node-postgres](https://node-postgres.com/features/transactions), [liberación del cliente](https://node-postgres.com/apis/pool).

La ampliación siguiente compara las dos implementaciones con un fallo entre el pedido y el registro de pago. El esquema de prueba aísla cada ejecución y se elimina al terminar. Los importes `bigint` viajan como cadenas para no perder precisión en un `number` de JavaScript.

<details>
<summary>Ampliación opcional: todos los archivos de TypeScript y las nueve pruebas de integración</summary>

Además de Docker, necesitas Node.js `>=22.12.0` y pnpm `12.8.1`. El ZIP incluye los archivos siguientes y un lockfile con versiones resueltas. Si escribes el ejemplo manualmente, `pnpm install` generará tu lockfile.

Archivo: `transacciones/package.json`.

```json
{
  "name": "transactions-lab",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@12.8.1",
  "engines": {
    "node": ">=22.12.0"
  },
  "scripts": {
    "db:up": "docker compose up -d --wait",
    "db:down": "docker compose down --volumes",
    "test": "vitest run",
    "check": "tsc --noEmit",
    "experiment:atomicity": "tsx experiments/atomicity/run.ts"
  },
  "dependencies": {
    "pg": "8.23.1"
  },
  "devDependencies": {
    "@types/pg": "8.23.1",
    "tsx": "4.23.15",
    "typescript": "5.9.3",
    "vitest": "5.0.3"
  }
}
```

Archivo: `transacciones/pnpm-workspace.yaml`.

```yaml
allowBuilds:
  esbuild: true
```

Este archivo permite el script de instalación de `esbuild`, necesario para `tsx`. Es la configuración del laboratorio independiente extraído del ZIP. Dentro del repositorio del blog, las políticas de instalación viven en el workspace raíz. [Configuración de pnpm](https://pnpm.io/settings#allowbuilds).

Archivo: `transacciones/.gitignore`.

```text
node_modules/
```

Archivo: `transacciones/tsconfig.json`.

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["experiments/**/*.ts", "tests/**/*.ts"]
}
```

`NodeNext` hace que TypeScript compruebe los módulos con las reglas de Node. Por eso los imports locales usan `.js`, incluso cuando el archivo fuente es `.ts`. [Resolución de módulos](https://www.typescriptlang.org/docs/handbook/modules/reference.html#nodenext).

### Tablas y conexión del laboratorio

Archivo: `transacciones/db/migrations/001_init.sql`.

```sql
CREATE TABLE orders (
  id uuid PRIMARY KEY,
  total_minor bigint NOT NULL,
  currency text NOT NULL,
  status text NOT NULL DEFAULT 'created'
);

CREATE TABLE payments (
  id uuid PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES orders(id),
  amount_minor bigint NOT NULL,
  currency text NOT NULL,
  status text NOT NULL DEFAULT 'created'
);
```

Este esquema deliberadamente pequeño contiene una clave foránea, pero **no impide importes negativos ni exige que coincidan los importes del pedido y el pago**. Una prueba demuestra ese límite. No es un modelo de pagos listo para producción.

Archivo: `transacciones/experiments/atomicity/database.ts`.

```typescript
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { Pool } from 'pg'

export async function createLabDatabase() {
  const schema = `tx_${randomUUID().replaceAll('-', '')}`
  // No se acepta una URL externa: los tests solo conectan al laboratorio local.
  const configuration = {
    host: '127.0.0.1',
    port: Number(process.env.TRANSACTIONS_DB_PORT ?? 55434),
    database: 'transactions_lab',
    user: 'lab',
    password: 'local-lab-only',
    connectionTimeoutMillis: 5000,
  }
  const admin = new Pool(configuration)
  const pool = new Pool({ ...configuration, options: `-c search_path=${schema},public` })
  let schemaCreated = false
  async function close() {
    try {
      await pool.end()
    } finally {
      try {
        if (schemaCreated) await admin.query(`DROP SCHEMA ${schema} CASCADE`)
      } finally {
        await admin.end()
      }
    }
  }
  try {
    await admin.query(`CREATE SCHEMA ${schema}`)
    schemaCreated = true
    const migration = await readFile(
      new URL('../../db/migrations/001_init.sql', import.meta.url),
      'utf8',
    )
    await pool.query(migration)
  } catch (error) {
    try {
      await close()
    } catch (cleanupError) {
      throw new AggregateError(
        [error, cleanupError],
        'Inicialización y limpieza fallidas',
      )
    }
    throw error
  }
  return { pool, close }
}
```

La función auxiliar (_helper_) solo conecta al PostgreSQL local de Compose. Crea un esquema (_schema_) con nombre aleatorio y configura `search_path` para que cada prueba trabaje sobre sus propias tablas. La limpieza (_cleanup_) libera los pools incluso si falla la eliminación del esquema.

Archivo: `transacciones/experiments/atomicity/types.ts`.

```typescript
export type CreationInput = {
  orderId: string
  paymentId: string
  amountMinor: string
  currency: string
}
```

### Implementación sin agrupar: permite el estado parcial

Archivo: `transacciones/experiments/atomicity/no-transaction.ts`.

```typescript
import type { Pool } from 'pg'
import type { CreationInput } from './types.js'

// EJEMPLO INCORRECTO: únicamente para reproducir el fallo de escrituras parciales.
export async function createWithoutTransaction(
  pool: Pool,
  input: CreationInput,
  failAfterOrder = false,
) {
  await pool.query('INSERT INTO orders (id, total_minor, currency) VALUES ($1, $2, $3)', [
    input.orderId,
    input.amountMinor,
    input.currency,
  ])
  if (failAfterOrder) throw new Error('Fallo inducido después de crear el pedido')
  await pool.query(
    'INSERT INTO payments (id, order_id, amount_minor, currency) VALUES ($1, $2, $3, $4)',
    [input.paymentId, input.orderId, input.amountMinor, input.currency],
  )
}
```

El error ocurre después de insertar el pedido. Como cada consulta se confirma por separado, el pedido sobrevive.

### Implementación transaccional: confirma o descarta ambas escrituras

Archivo: `transacciones/experiments/atomicity/with-transaction.ts`.

```typescript
import type { Pool } from 'pg'
import type { CreationInput } from './types.js'

export async function createWithTransaction(
  pool: Pool,
  input: CreationInput,
  failAfterOrder = false,
) {
  const client = await pool.connect()
  let discardClient = false
  try {
    await client.query('BEGIN')
    await client.query(
      'INSERT INTO orders (id, total_minor, currency) VALUES ($1, $2, $3)',
      [input.orderId, input.amountMinor, input.currency],
    )
    if (failAfterOrder) throw new Error('Fallo inducido después de crear el pedido')
    await client.query(
      'INSERT INTO payments (id, order_id, amount_minor, currency) VALUES ($1, $2, $3, $4)',
      [input.paymentId, input.orderId, input.amountMinor, input.currency],
    )
    await client.query('COMMIT')
  } catch (error) {
    try {
      await client.query('ROLLBACK')
    } catch (rollbackError) {
      discardClient = true
      throw new AggregateError(
        [error, rollbackError],
        'Operación fallida; rollback no confirmado',
      )
    }
    throw error
  } finally {
    client.release(discardClient)
  }
}
```

El mismo cliente recibe `BEGIN`, las dos escrituras y `COMMIT`. Si se lanza una excepción, intentamos rollback. Si también falla ese intento, conservamos ambos errores y descartamos la conexión al liberarla. No hay reintento automático de un commit con resultado incierto.

### Experimento que imprime los estados observados

Archivo: `transacciones/experiments/atomicity/run.ts`.

```typescript
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { arch, platform } from 'node:os'
import { createLabDatabase } from './database.js'
import { createWithoutTransaction } from './no-transaction.js'
import { createWithTransaction } from './with-transaction.js'

const database = await createLabDatabase()
const input = () => ({
  orderId: randomUUID(),
  paymentId: randomUUID(),
  amountMinor: '2500',
  currency: 'EUR',
})
async function snapshot(label: string) {
  const { rows } = await database.pool.query(
    'SELECT (SELECT count(*)::int FROM orders) AS orders, (SELECT count(*)::int FROM payments) AS payments',
  )
  console.log(label, JSON.stringify(rows[0]))
}
try {
  const { rows } = await database.pool.query(
    "SELECT current_setting('server_version') AS postgres, current_setting('fsync') AS fsync, current_setting('synchronous_commit') AS synchronous_commit, current_setting('full_page_writes') AS full_page_writes, current_setting('transaction_isolation') AS isolation",
  )
  console.log(
    'Entorno',
    JSON.stringify({
      node: process.version,
      platform: platform(),
      arch: arch(),
      ...rows[0],
    }),
  )
  await snapshot('Sin transacción / antes')
  await assert.rejects(
    createWithoutTransaction(database.pool, input(), true),
    /Fallo inducido/,
  )
  await snapshot('Sin transacción / después del fallo')
  await database.pool.query('TRUNCATE payments, orders')
  await snapshot('Con transacción / antes')
  await assert.rejects(
    createWithTransaction(database.pool, input(), true),
    /Fallo inducido/,
  )
  await snapshot('Con transacción / después del rollback')
  await snapshot('Con transacción / antes del caso correcto')
  await createWithTransaction(database.pool, input())
  await snapshot('Con transacción / después del commit')
  const result = await database.pool.query(
    'SELECT o.total_minor, p.amount_minor, p.currency, p.status FROM payments p JOIN orders o ON o.id = p.order_id',
  )
  console.log('Pago interno confirmado en DB', JSON.stringify(result.rows))
} finally {
  await database.close()
}
```

### Pruebas con PostgreSQL real

Archivo: `transacciones/tests/integration/atomicity.test.ts`.

```typescript
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createLabDatabase } from '../../experiments/atomicity/database.js'
import { createWithoutTransaction } from '../../experiments/atomicity/no-transaction.js'
import { createWithTransaction } from '../../experiments/atomicity/with-transaction.js'

let database: Awaited<ReturnType<typeof createLabDatabase>>
const input = () => ({
  orderId: randomUUID(),
  paymentId: randomUUID(),
  amountMinor: '2500',
  currency: 'EUR',
})
async function counts() {
  const result = await database.pool.query<{ orders: number; payments: number }>(
    'SELECT (SELECT count(*)::int FROM orders) AS orders, (SELECT count(*)::int FROM payments) AS payments',
  )
  return result.rows[0]
}

beforeAll(async () => {
  database = await createLabDatabase()
})
beforeEach(async () => {
  await database.pool.query('TRUNCATE payments, orders')
})
afterAll(async () => {
  await database?.close()
})

describe('Transacciones: efecto persistido, no solo respuesta de la función', () => {
  it('reproduce el pedido sin pago al fallar entre escrituras independientes', async () => {
    await expect(createWithoutTransaction(database.pool, input(), true)).rejects.toThrow(
      'Fallo inducido',
    )
    expect(await counts()).toEqual({ orders: 1, payments: 0 })
  })
  it('no deja ninguna fila al fallar entre escrituras de una transacción', async () => {
    await expect(createWithTransaction(database.pool, input(), true)).rejects.toThrow(
      'Fallo inducido',
    )
    expect(await counts()).toEqual({ orders: 0, payments: 0 })
  })
  it('confirma ambas filas con los mismos importes y moneda', async () => {
    const request = input()
    await createWithTransaction(database.pool, request)
    expect(await counts()).toEqual({ orders: 1, payments: 1 })
    const { rows } = await database.pool.query(
      'SELECT p.order_id, o.total_minor, p.amount_minor, p.currency, p.status FROM payments p JOIN orders o ON o.id = p.order_id',
    )
    expect(rows).toEqual([
      {
        order_id: request.orderId,
        total_minor: '2500',
        amount_minor: '2500',
        currency: 'EUR',
        status: 'created',
      },
    ])
  })
  it('revierte el pedido si la segunda escritura falla en PostgreSQL', async () => {
    await expect(
      createWithTransaction(database.pool, {
        ...input(),
        amountMinor: '9223372036854775807',
      }),
    ).resolves.toBeUndefined()
    // Reutilizar un paymentId provoca una violación de PK después de insertar otro pedido.
    const payment = await database.pool.query<{ id: string }>('SELECT id FROM payments')
    await expect(
      createWithTransaction(database.pool, {
        ...input(),
        paymentId: payment.rows[0]!.id,
      }),
    ).rejects.toMatchObject({ code: '23505' })
    expect(await counts()).toEqual({ orders: 1, payments: 1 })
  })
  it('una sesión observadora no ve escrituras sin confirmar', async () => {
    const client = await database.pool.connect()
    try {
      await client.query('BEGIN')
      await client.query(
        'INSERT INTO orders (id, total_minor, currency) VALUES ($1, 2500, $2)',
        [randomUUID(), 'EUR'],
      )
      expect(await counts()).toEqual({ orders: 0, payments: 0 })
    } finally {
      await client.query('ROLLBACK')
      client.release()
    }
  })
  it('un error SQL bloquea la transacción hasta rollback o rollback a un savepoint', async () => {
    const client = await database.pool.connect()
    const request = input()
    try {
      await client.query('BEGIN')
      await client.query(
        'INSERT INTO orders (id, total_minor, currency) VALUES ($1, 2500, $2)',
        [request.orderId, 'EUR'],
      )
      await client.query('SAVEPOINT optional_work')
      await expect(client.query('SELECT 1 / 0')).rejects.toMatchObject({ code: '22012' })
      await expect(client.query('SELECT 1')).rejects.toMatchObject({ code: '25P02' })
      await client.query('ROLLBACK TO SAVEPOINT optional_work')
      await client.query(
        'INSERT INTO payments (id, order_id, amount_minor, currency) VALUES ($1, $2, 2500, $3)',
        [request.paymentId, request.orderId, 'EUR'],
      )
      await client.query('RELEASE SAVEPOINT optional_work')
      expect(await counts()).toEqual({ orders: 0, payments: 0 })
      await client.query('COMMIT')
      expect(await counts()).toEqual({ orders: 1, payments: 1 })
    } finally {
      await client.query('ROLLBACK')
      client.release()
    }
  })
  it('cerrar una sesión antes de COMMIT descarta sus escrituras', async () => {
    const client = await database.pool.connect()
    const { rows } = await client.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')
    try {
      await client.query('BEGIN')
      await client.query(
        'INSERT INTO orders (id, total_minor, currency) VALUES ($1, 2500, $2)',
        [randomUUID(), 'EUR'],
      )
    } finally {
      client.release(true)
    }
    // Esperar el cierre del backend evita confundir invisibilidad con rollback efectivo.
    await expect
      .poll(
        async () => {
          const result = await database.pool.query(
            'SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE pid = $1) AS active',
            [rows[0]!.pid],
          )
          return result.rows[0].active
        },
        { timeout: 3000 },
      )
      .toBe(false)
    expect(await counts()).toEqual({ orders: 0, payments: 0 })
  })
  it('una transacción puede confirmar un importe negativo si nadie lo prohíbe', async () => {
    await createWithTransaction(database.pool, { ...input(), amountMinor: '-2500' })
    const result = await database.pool.query('SELECT amount_minor FROM payments')
    expect(result.rows).toEqual([{ amount_minor: '-2500' }])
  })
  it('COMMIT sobre un bloque abortado termina con ROLLBACK, no con confirmación', async () => {
    const client = await database.pool.connect()
    try {
      await client.query('BEGIN')
      await client.query(
        'INSERT INTO orders (id, total_minor, currency) VALUES ($1, 2500, $2)',
        [randomUUID(), 'EUR'],
      )
      await expect(client.query('SELECT 1 / 0')).rejects.toMatchObject({ code: '22012' })
      const result = await client.query('COMMIT')
      expect(result.command).toBe('ROLLBACK')
      expect(await counts()).toEqual({ orders: 0, payments: 0 })
    } finally {
      await client.query('ROLLBACK')
      client.release()
    }
  })
})
```

Las nueve pruebas comprueban el estado parcial, rollback por error de aplicación, confirmación correcta, error SQL en la segunda escritura, visibilidad desde otra sesión, recuperación a savepoint, cierre antes del commit, una regla no declarada y el comando devuelto al intentar confirmar un bloque abortado.

No usan dobles de la base de datos. Tampoco miden throughput ni simulan un corte eléctrico o una pérdida de respuesta después de un commit ejecutado.

### Ejecutar la ampliación

Desde `transacciones/`, con PostgreSQL ya arrancado:

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm experiment:atomicity
```

Si creaste manualmente los archivos y todavía no tienes lockfile, usa `pnpm install` la primera vez en lugar de `--frozen-lockfile`.

El experimento produce estos conteos:

<div class="overflow-x-auto" role="region" aria-label="Conteos del experimento de TypeScript" tabindex="0">

| Recorrido                      | Pedidos | Registros de pago |
| ------------------------------ | ------: | ----------------: |
| Fallo sin bloque transaccional |       1 |                 0 |
| Fallo con rollback             |       0 |                 0 |
| Recorrido confirmado           |       1 |                 1 |

</div>

Los registros de pago quedan en estado `created`: el experimento confirma datos internos, no cobros externos.

</details>

## Mantén la transacción acotada al trabajo necesario

En un servicio real, incluye las lecturas y escrituras que deben coordinarse, y evita dejar un bloque abierto mientras esperas interacción del usuario o servicios lentos. Un bloque que modifica filas puede mantener bloqueos (_locks_) hasta terminar, además de ocupar una conexión del pool. [Bloqueos explícitos](https://www.postgresql.org/docs/18/explicit-locking.html).

No ocultes errores para llegar a `COMMIT`. Define qué fallos cancelan la unidad completa, qué partes pueden recuperarse con savepoints y qué respuestas requieren verificar el resultado antes de repetir.

## Preguntas habituales sobre transacciones

### ¿Puedo abrir una transacción dentro de otra con BEGIN?

Otro `BEGIN` no crea un bloque independiente en PostgreSQL. Usa savepoints si necesitas delimitar una parte recuperable. [Referencia de BEGIN](https://www.postgresql.org/docs/18/sql-begin.html).

### ¿Todas las escrituras de una petición deben compartir transacción?

Solo las que necesitan confirmarse juntas según las reglas de esa operación. No amplíes la frontera únicamente porque ocurrieron en la misma petición.

### ¿Qué prueba demuestra que mi transacción está bien?

Una prueba útil induce un fallo entre las escrituras y verifica el estado final desde la base de datos. Añade casos de concurrencia (_concurrency_) cuando las reglas dependan de otros escritores; comprobar solo que una función lanza un error no demuestra rollback.

Al terminar, elimina el contenedor y los volúmenes **de este laboratorio**:

```bash
docker compose down --volumes
```

Puedes repetir el ejemplo con una regla distinta: intenta transferir a una cuenta inexistente y comprueba que la aplicación detectaría cero filas modificadas antes de confirmar. Es una buena forma de conectar la frontera transaccional con las reglas explicadas en [Propiedades ACID](/posts/propiedades-acid-bases-de-datos).
