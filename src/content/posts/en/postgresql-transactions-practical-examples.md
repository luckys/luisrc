---
id: DB-TRANSACTIONS
title: 'PostgreSQL transactions: BEGIN, COMMIT, ROLLBACK and SAVEPOINT with examples'
published: 2026-10-10T00:01:00Z
locale: en
translationKey: postgresql-transactions-practical-examples
slug: postgresql-transactions-practical-examples
draft: true
status: draft
level: intermediate
prerequisites: [DB-ACID]
related: [DB-ACID]
last_verified: 2026-10-10
description: 'Learn transaction boundaries, SQL error handling and SAVEPOINT with Docker Compose. Includes diagrams, application examples and an optional runnable TypeScript lab with Vitest.'
author: 'Luis Ramírez Calle'
series: 'Database fundamentals'
tags: ['postgresql', 'transactions', 'sql', 'typescript', 'docker', 'backend', 'testing']
---

Your code runs two writes and returns an error if the second fails. That tells you nothing about what happened to the first. To answer that, you need to know where the transaction starts, which session runs it and how it ends.

We will practice `BEGIN`, `COMMIT`, `ROLLBACK` and `SAVEPOINT` with PostgreSQL. We will start with SQL, or _Structured Query Language_, so an ORM, or _Object-Relational Mapping_ layer, does not hide the behavior. An optional extension then provides every file for a TypeScript application and nine integration tests.

If you need to review what these operations guarantee, start with [ACID properties](/en/posts/acid-properties-databases). That article reproduces failures involving transfers, inventory and concurrent readers.

## What is a transaction, and how do you choose its boundary?

A **transaction** defines a unit of work you want to commit or discard together. The transaction boundary depends on what must be valid when the operation ends, not on how many lines a function contains.

For example, issuing an invoice might require saving its header and every line. Committing only the header leaves an object the application may not be able to use. In a reservation, deducting an available place and creating the registration can also form one operation.

An HTTP request may need one transaction, several or no explicit transaction at all. Neither an asynchronous function nor a call to `Promise.all` automatically groups PostgreSQL writes.

## Set up PostgreSQL and the example data

[Download the complete lab](/assets/examples/transactions-lab-en.zip) and enter the `transactions/` directory. If you build it manually, create that directory and `sql/`, then copy the following two files. The SQL sections only require Docker with Compose.

File: `transactions/docker-compose.yml`.

```yaml
name: luisrc-transactions-lab
services:
  postgres:
    image: postgres:18.4-alpine3.23@sha256:996d0920e4ff9df1fc19dacb904492f3c1ec0ec1cc338f0ad7123be7731c5f5e
    environment:
      POSTGRES_DB: transactions_lab
      POSTGRES_USER: lab
      # Public fictional credential, only for this local lab.
      POSTGRES_PASSWORD: local-lab-only
    ports:
      - '127.0.0.1:${TRANSACTIONS_DB_PORT:-55434}:5432'
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U lab -d transactions_lab']
      interval: 1s
      timeout: 3s
      retries: 30
```

The host port is bound to `127.0.0.1`. These fictional credentials belong only to the lab. The tag and digest pin the server used for validation.

File: `transactions/sql/setup.sql`.

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

-- Reset only the fictional tables used in these examples.
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

The last command opens an interactive session. Run the following examples inside that session. The setup resets the demonstration tables: only use it in this lab, after closing other transactions.

## Autocommit: successful statements do not automatically form one operation

In the `psql` client used here, each successful statement outside an explicit block is committed individually. If you debit an account and the credit then fails, the first change is already saved. [Autocommit and BEGIN](https://www.postgresql.org/docs/18/sql-begin.html).

The TypeScript extension demonstrates the same problem: we first insert an order and then its **internal payment record**. Creating that record does not charge money or call a provider.

<img src="/assets/visuals/database-fundamentals/en/independent-writes.svg" alt="The application inserts an order, which PostgreSQL commits. It fails before inserting the internal payment. Another session sees an order without a payment; a later rollback does not undo the earlier commit." width="1224" height="1366" loading="lazy" style="width:100%;height:auto" />

_A foreign key requires a payment to have an order, but does not require every order to have a payment._

[Open the diagram to enlarge it](/assets/visuals/database-fundamentals/en/independent-writes.svg).

To prevent the partial state, both writes must belong to the same block and the same session. That session holds the transaction context.

## BEGIN and COMMIT: commit two changes together

`BEGIN` starts the block; `COMMIT` requests that its changes be committed. In the interactive session, run:

```sql
SET search_path TO concept_examples;
BEGIN;
UPDATE accounts SET balance_minor = balance_minor - 2500 WHERE id = 1;
UPDATE accounts SET balance_minor = balance_minor + 2500 WHERE id = 2;
SELECT * FROM accounts ORDER BY id;
COMMIT;
```

Starting from the setup, the session sees `7500` and `7500` before committing: a transaction can read its own writes. Another session still sees the previous data while the block is open. A new query in `READ COMMITTED` can see the changes after the commit.

<img src="/assets/visuals/database-fundamentals/en/atomic-transaction.svg" alt="An order is inserted inside the transaction. Another reader cannot see it yet. If the application fails, rollback leaves zero orders and payments. In the alternative path, the payment is inserted and commit makes both visible." width="1039" height="1632" loading="lazy" style="width:100%;height:auto" />

_Two alternative paths: discard pending work or commit the complete unit._

[Open the diagram to enlarge it](/assets/visuals/database-fundamentals/en/atomic-transaction.svg).

In an application, check the result of every step. An `UPDATE` affecting zero rows is not an SQL error: if you needed to modify exactly one account, that result requires a decision before committing.

`COMMIT` ends the block; you cannot undo it afterwards with `ROLLBACK`. Correcting an already committed transfer requires another business operation, such as a reversal with its own record. [COMMIT](https://www.postgresql.org/docs/18/sql-commit.html).

## ROLLBACK: discard work that has not been committed

After the previous transfer, run:

```sql
BEGIN;
UPDATE documents SET body = 'discarded change' WHERE id = 1;
SELECT * FROM documents;
ROLLBACK;
SELECT * FROM documents;
```

The first query shows the pending change in this session. After rollback, the original value, `draft`, appears again. [ROLLBACK](https://www.postgresql.org/docs/18/sql-rollback.html).

This also applies when the decision to cancel comes from the application. If a later validation fails, your code must end the block correctly; PostgreSQL does not automatically receive JavaScript exceptions.

## An SQL error can leave the transaction aborted

Try this block in the same session:

```sql
BEGIN;
SELECT 1 / 0;
SELECT * FROM documents;
COMMIT;
```

The division returns SQLSTATE `22012`. The next `SELECT` fails with `25P02`: the transaction is already aborted. The final `COMMIT` returns the command `ROLLBACK` and discards the work.

**Sending COMMIT does not prove that anything was committed.** The client must detect earlier failures. A driver may resolve the final query with `command: 'ROLLBACK'`; do not ignore earlier statement errors and treat the ending as success. [Protocol states](https://www.postgresql.org/docs/18/protocol-flow.html).

If you need to abandon all the work, send `ROLLBACK`. If you defined a suitable savepoint before the failure, you can recover to that point instead.

## SAVEPOINT: recover one part without losing earlier work

A **savepoint** marks a point inside a transaction. Returning to it discards later changes and allows you to continue after an SQL error has aborted the block. Releasing it removes that point; **it does not commit the outer transaction**. [SAVEPOINT](https://www.postgresql.org/docs/18/sql-savepoint.html), [ROLLBACK TO SAVEPOINT](https://www.postgresql.org/docs/18/sql-rollback-to.html).

<img src="/assets/visuals/database-fundamentals/en/savepoint.svg" alt="BEGIN groups the debit and credit. A savepoint precedes optional work that fails. Rolling back to the savepoint preserves the main work. Release removes the point, and commit confirms the transaction at the end." width="700" height="1298" loading="lazy" style="width:100%;height:auto" />

_The optional failure can be recovered because we set a savepoint before the attempt._

[Open the diagram to enlarge it](/assets/visuals/database-fundamentals/en/savepoint.svg).

This file contains the complete path. Close the interactive session with `\q` and reset the data before running it:

File: `transactions/sql/transactions.sql`.

```sql
-- This file includes an intentional error to practice SAVEPOINT.
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

The file continues after the intentional division error because `ON_ERROR_STOP` is `off`. The final balances are `7500` and `7500`. The document remains `draft` because its second block is rolled back.

### A realistic use of savepoints

In a batch import, you could keep valid rows and discard a row that violates a rule, if the business accepts partial imports. Each attempt can have its own savepoint, and the result must report which rows were not imported.

That would be the wrong decision if the batch must be accepted or rejected as a whole. You should not use a savepoint to ignore a failure in an essential step, such as the credit in our transfer.

The division in the file is an easily reproducible failure injection. The diagram explains recovery mechanics; it does not propose a particular optional calculation for a real transfer.

## SQL, application and connection errors need different responses

<div class="overflow-x-auto" role="region" aria-label="Responses to transaction errors" tabindex="0">

| Situation                                | What the system knows                                                | What the application must do                                               |
| ---------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Application error before commit          | The session may still have an open transaction.                      | Send rollback and propagate the failure.                                   |
| SQL error inside the block               | The transaction may be aborted.                                      | Roll back completely or recover to a planned savepoint.                    |
| Disconnection before sending commit      | The session did not commit that block.                               | PostgreSQL discards it after detecting the closure; do not report success. |
| Connection lost while waiting for commit | The commit may have executed even though its response never arrived. | Treat the result as uncertain and reconcile it before repeating.           |

</div>

The last case is an **unknown commit outcome**. It matters when saving purchases, financial movements or registrations. Blindly repeating an operation after a network error can duplicate something already committed. You need a way to identify the operation and query its result. The TypeScript example does not implement this reconciliation or claim to solve it.

A local transaction does not automatically include an HTTP charge, an email or a file written to another service. Keeping a slow call inside the block extends connection usage and lock duration, and rollback does not undo its external effects.

<img src="/assets/visuals/database-fundamentals/en/external-service-boundary.svg" alt="The application opens a local transaction and asks another service to send an email. The email is sent, but the application fails and rolls back PostgreSQL. The message remains sent because the external service does not participate in the rollback." width="1061" height="1198" loading="lazy" style="width:100%;height:auto" />

_The local state is rolled back; an email already sent needs a different coordination strategy._

[Open the diagram to enlarge it](/assets/visuals/database-fundamentals/en/external-service-boundary.svg).

## Use a single connection in your application

With `node-postgres`, acquire a client from the connection pool and run **all** statements in the block through that client. Separate calls to `pool.query` can use different connections; you cannot assume they share a session. Release the client when finished. [Transactions with node-postgres](https://node-postgres.com/features/transactions), [releasing clients](https://node-postgres.com/apis/pool).

The extension below compares both implementations with a failure between the order and its payment record. A separate test schema isolates each run and is removed afterwards. `bigint` amounts travel as strings to avoid losing precision in a JavaScript `number`.

<details>
<summary>Optional extension: every TypeScript file and all nine integration tests</summary>

Besides Docker, you need Node.js `>=22.12.0` and pnpm `12.8.1`. The ZIP includes the following files and a lockfile with resolved versions. If you write the example manually, `pnpm install` generates your lockfile.

File: `transactions/package.json`.

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

File: `transactions/pnpm-workspace.yaml`.

```yaml
allowBuilds:
  esbuild: true
```

This file allows the `esbuild` installation script required by `tsx`. It configures the standalone lab extracted from the ZIP. Inside the blog repository, installation policies live in the root workspace. [pnpm settings](https://pnpm.io/settings#allowbuilds).

File: `transactions/.gitignore`.

```text
node_modules/
```

File: `transactions/tsconfig.json`.

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

`NodeNext` makes TypeScript check modules using Node's rules. That is why local imports use `.js`, even when the source file is `.ts`. [Module resolution](https://www.typescriptlang.org/docs/handbook/modules/reference.html#nodenext).

### Lab tables and connection

File: `transactions/db/migrations/001_init.sql`.

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

This deliberately small schema contains a foreign key, but **does not prevent negative amounts or require the order and payment amounts to match**. A test demonstrates that limit. This is not a production-ready payment model.

File: `transactions/experiments/atomicity/database.ts`.

```typescript
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { Pool } from 'pg'

export async function createLabDatabase() {
  const schema = `tx_${randomUUID().replaceAll('-', '')}`
  // External URLs are not accepted: tests only connect to the local lab.
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
        'Initialization and cleanup failed',
      )
    }
    throw error
  }
  return { pool, close }
}
```

The helper only connects to the local PostgreSQL instance in Compose. It creates a randomly named schema and sets `search_path` so each test uses its own tables. Cleanup releases the pools even if dropping the schema fails.

File: `transactions/experiments/atomicity/types.ts`.

```typescript
export type CreationInput = {
  orderId: string
  paymentId: string
  amountMinor: string
  currency: string
}
```

### Separate writes: the partial state survives

File: `transactions/experiments/atomicity/no-transaction.ts`.

```typescript
import type { Pool } from 'pg'
import type { CreationInput } from './types.js'

// INCORRECT EXAMPLE: only to reproduce the partial-write failure.
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
  if (failAfterOrder) throw new Error('Induced failure after creating the order')
  await pool.query(
    'INSERT INTO payments (id, order_id, amount_minor, currency) VALUES ($1, $2, $3, $4)',
    [input.paymentId, input.orderId, input.amountMinor, input.currency],
  )
}
```

The error occurs after inserting the order. Each query is committed separately, so the order survives.

### Transactional implementation: commit or discard both writes

File: `transactions/experiments/atomicity/with-transaction.ts`.

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
    if (failAfterOrder) throw new Error('Induced failure after creating the order')
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
        'Operation failed; rollback not acknowledged',
      )
    }
    throw error
  } finally {
    client.release(discardClient)
  }
}
```

The same client receives `BEGIN`, both writes and `COMMIT`. If an exception is thrown, we attempt rollback. If that also fails, we preserve both errors and discard the connection when releasing it. There is no automatic retry of a commit whose outcome is uncertain.

### Experiment that prints the observed states

File: `transactions/experiments/atomicity/run.ts`.

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
    'Environment',
    JSON.stringify({
      node: process.version,
      platform: platform(),
      arch: arch(),
      ...rows[0],
    }),
  )
  await snapshot('Without transaction / before')
  await assert.rejects(
    createWithoutTransaction(database.pool, input(), true),
    /Induced failure/,
  )
  await snapshot('Without transaction / after failure')
  await database.pool.query('TRUNCATE payments, orders')
  await snapshot('With transaction / before')
  await assert.rejects(
    createWithTransaction(database.pool, input(), true),
    /Induced failure/,
  )
  await snapshot('With transaction / after rollback')
  await snapshot('With transaction / before successful path')
  await createWithTransaction(database.pool, input())
  await snapshot('With transaction / after commit')
  const result = await database.pool.query(
    'SELECT o.total_minor, p.amount_minor, p.currency, p.status FROM payments p JOIN orders o ON o.id = p.order_id',
  )
  console.log('Internal payment record committed in DB', JSON.stringify(result.rows))
} finally {
  await database.close()
}
```

### Tests with real PostgreSQL

File: `transactions/tests/integration/atomicity.test.ts`.

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

describe('Transactions: persisted effects, not just function responses', () => {
  it('reproduces an order without a payment when separate writes fail', async () => {
    await expect(createWithoutTransaction(database.pool, input(), true)).rejects.toThrow(
      'Induced failure',
    )
    expect(await counts()).toEqual({ orders: 1, payments: 0 })
  })
  it('leaves no rows when a failure occurs between transactional writes', async () => {
    await expect(createWithTransaction(database.pool, input(), true)).rejects.toThrow(
      'Induced failure',
    )
    expect(await counts()).toEqual({ orders: 0, payments: 0 })
  })
  it('commits both rows with matching amounts and currency', async () => {
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
  it('rolls back the order if the second write fails in PostgreSQL', async () => {
    await expect(
      createWithTransaction(database.pool, {
        ...input(),
        amountMinor: '9223372036854775807',
      }),
    ).resolves.toBeUndefined()
    // Reusing a paymentId causes a PK violation after inserting another order.
    const payment = await database.pool.query<{ id: string }>('SELECT id FROM payments')
    await expect(
      createWithTransaction(database.pool, {
        ...input(),
        paymentId: payment.rows[0]!.id,
      }),
    ).rejects.toMatchObject({ code: '23505' })
    expect(await counts()).toEqual({ orders: 1, payments: 1 })
  })
  it('an observer session does not see uncommitted writes', async () => {
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
  it('an SQL error blocks the transaction until rollback or rollback to a savepoint', async () => {
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
  it('closing a session before COMMIT discards its writes', async () => {
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
    // Waiting for the backend to close distinguishes invisibility from completed rollback.
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
  it('a transaction can commit a negative amount if no rule forbids it', async () => {
    await createWithTransaction(database.pool, { ...input(), amountMinor: '-2500' })
    const result = await database.pool.query('SELECT amount_minor FROM payments')
    expect(result.rows).toEqual([{ amount_minor: '-2500' }])
  })
  it('COMMIT on an aborted transaction returns ROLLBACK rather than committing', async () => {
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

The nine tests check the partial state, rollback after an application error, successful commit, an SQL error on the second write, visibility from another session, recovery to a savepoint, closure before commit, an undeclared rule, and the command returned when trying to commit an aborted transaction.

They do not use database test doubles. They do not measure throughput, simulate a power cut or lose the response to an executed commit.

### Run the extension

From `transactions/`, with PostgreSQL already running:

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm experiment:atomicity
```

If you created the files manually and do not yet have a lockfile, use `pnpm install` the first time instead of `--frozen-lockfile`.

The experiment produces these counts:

<div class="overflow-x-auto" role="region" aria-label="TypeScript experiment counts" tabindex="0">

| Path                                | Orders | Payment records |
| ----------------------------------- | -----: | --------------: |
| Failure without a transaction block |      1 |               0 |
| Failure with rollback               |      0 |               0 |
| Committed path                      |      1 |               1 |

</div>

The payment records stay in the `created` state: the experiment commits internal data, not external charges.

</details>

## Keep the transaction limited to the necessary work

In a real service, include the reads and writes that need coordination, and avoid keeping a block open while waiting for user interaction or slow services. A block that modifies rows can hold locks until it ends, while also occupying a pool connection. [Explicit locking](https://www.postgresql.org/docs/18/explicit-locking.html).

Do not hide errors just to reach `COMMIT`. Define which failures cancel the complete unit, which parts can be recovered with savepoints, and which responses require checking the outcome before repeating.

## Common questions about transactions

### Can I start a transaction inside another with BEGIN?

Another `BEGIN` does not create an independent block in PostgreSQL. Use savepoints if you need to define a recoverable part. [BEGIN reference](https://www.postgresql.org/docs/18/sql-begin.html).

### Must every write in a request share a transaction?

Only the writes that must be committed together under that operation's rules. Do not expand the boundary merely because they occurred in the same request.

### What test shows that my transaction works correctly?

A useful test injects a failure between writes and checks the final database state. Add concurrency cases when the rules depend on other writers; checking only that a function throws an error does not prove rollback.

When finished, remove **this lab's container and volumes**:

```bash
docker compose down --volumes
```

You can repeat the example with a different rule: try transferring to a nonexistent account and check that the application would detect zero modified rows before committing. This connects the transaction boundary to the rules explained in [ACID properties](/en/posts/acid-properties-databases).
