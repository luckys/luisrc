---
id: DB-ACID
title: 'ACID properties: what a database guarantees and what your code must handle'
published: 2026-10-10
locale: en
translationKey: database-acid-properties
slug: acid-properties-databases
draft: true
status: draft
level: intermediate
prerequisites: []
related: [DB-TRANSACTIONS]
last_verified: 2026-10-10
description: 'Understand atomicity, consistency, isolation and durability with diagrams and runnable SQL examples: transfers, inventory, concurrent reads and saved documents.'
author: 'Luis Ramírez Calle'
series: 'Database fundamentals'
tags: ['postgresql', 'acid', 'databases', 'sql', 'backend', 'system-design']
---

A transfer deducts 25 euros from one account and fails before crediting the other. Each SQL query is correct on its own, but the overall result is wrong: 25 euros are missing.

The **ACID** properties help you reason about these failures. They also explain why wrapping code in a transaction is not enough to prevent negative stock or guarantee identical reads in every situation.

We will examine each property through a recognizable problem, a diagram and a PostgreSQL experiment. These are educational examples of situations found in real applications; the fictional accounts are not a complete banking system. You need to know `SELECT`, `UPDATE` and basic table creation. We will run the examples with Docker Compose, so you do not need to install PostgreSQL on your computer.

## What are the ACID properties?

**ACID** stands for _Atomicity, Consistency, Isolation_ and _Durability_. These four guarantees address different questions when you design an operation:

<div class="overflow-x-auto" role="region" aria-label="ACID properties and examples" tabindex="0">

| Property    | Question it answers                           | Example                                                             |
| ----------- | --------------------------------------------- | ------------------------------------------------------------------- |
| Atomicity   | Can part of an operation remain committed?    | Debit and credit a transfer together.                               |
| Consistency | Does the result obey the defined rules?       | Prevent inventory from becoming negative.                           |
| Isolation   | How do concurrent operations interact?        | Control what a dashboard sees while another user changes a balance. |
| Durability  | What happens to committed data after a crash? | Recover a document whose save was acknowledged.                     |

</div>

These guarantees apply to a **transaction**, a unit of work in the database. To group several statements in PostgreSQL, we start with `BEGIN` and finish with `COMMIT` to keep the changes, or `ROLLBACK` to discard them.

Without an explicit block, the `psql` client used here operates in **autocommit** mode: each successful statement is committed separately. That distinction explains our first failure. [BEGIN reference](https://www.postgresql.org/docs/18/sql-begin.html).

This article focuses on the guarantees. [PostgreSQL transactions: BEGIN, COMMIT, ROLLBACK and SAVEPOINT](/en/posts/postgresql-transactions-practical-examples) explains how to define the boundary, handle errors and use transactions in an application.

## Set up a small lab with Docker Compose

You can [download the files for both articles](/assets/examples/transactions-lab-en.zip), extract them and enter `transactions/`. If you prefer to write them yourself, create that directory and its `sql/` subdirectory, then copy the files in this section and each example.

For this part, you only need Docker with Compose. The server is accessible at `127.0.0.1:55434`; the `psql` client runs inside the container. The image pins a version and digest to make the environment reproducible. These public, fictional credentials belong only to this local database.

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

The health check lets Compose wait until PostgreSQL accepts connections before you run queries. It does not check your application's business rules. [Startup order and dependencies in Compose](https://docs.docker.com/compose/how-tos/startup-order/).

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

We store balances in cents: `10000` represents 100 euros. The examples therefore use integers without introducing floating-point rounding. The `concept_examples` schema separates these fictional tables from the TypeScript example's tables.

From the `transactions/` directory, run:

```bash
docker compose up -d --wait
docker compose exec -T postgres psql -U lab -d transactions_lab -v ON_ERROR_STOP=1 < sql/setup.sql
```

The setup **resets the data in these three example tables**. You can rerun it before each experiment to restore the same values. If the port is already in use, set `TRANSACTIONS_DB_PORT` to another port when starting Compose; the queries in this article still run through the container.

## Atomicity: a transfer must not stop halfway

The initial state has two accounts: A holds 100 euros and B holds 50. We want to transfer 25 euros from A to B. Their total must remain 150 euros.

With separate writes, the debit can be committed before the credit. An application failure, a disconnection or a later failed query can leave an incomplete operation. Restarting the process does not reverse a debit that was already committed.

<img src="/assets/visuals/database-fundamentals/en/atomicity-transfer.svg" alt="A transfer starts with balances of 100 and 50 euros. With separate writes, a failure after the debit leaves 75 and 50. In one transaction, rollback preserves 100 and 50, or commit saves 75 and 75." width="1020" height="835" loading="lazy" style="width:100%;height:auto" />

_Three outcomes of the same operation. The total reveals the partial state._

[Open the diagram to enlarge it](/assets/visuals/database-fundamentals/en/atomicity-transfer.svg).

This file first reproduces the failure, then the rollback, and finally the successful path:

File: `transactions/sql/atomicity.sql`.

```sql
-- Division errors are intentional: psql must continue.
\set ON_ERROR_STOP off
SET search_path TO concept_examples;

\echo 'Without an explicit transaction: the first write is already committed'
UPDATE accounts SET balance_minor = balance_minor - 2500 WHERE id = 1;
SELECT 1 / 0;
SELECT * FROM accounts ORDER BY id;
SELECT sum(balance_minor) AS total_minor FROM accounts;

-- Restore the initial state of the example.
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

`SELECT 1 / 0` causes an intentional SQL error. `ON_ERROR_STOP off` lets `psql` continue through the file so you can inspect the later queries. This is a choice for the experiment, not a recommended migration policy.

You should observe these three results:

<div class="overflow-x-auto" role="region" aria-label="Balances observed in the atomicity experiments" tabindex="0">

| Path                     | Account A | Account B | Total |
| ------------------------ | --------: | --------: | ----: |
| Autocommit and failure   |      7500 |      5000 | 12500 |
| Transaction and rollback |     10000 |      5000 | 15000 |
| Complete transaction     |      7500 |      7500 | 15000 |

</div>

**Atomicity** means that the changes in the transaction are committed together or discarded; we call the operation **atomic**. In the second path, the debit was inside the block we rolled back. In the first, it already belonged to a committed transaction. [ROLLBACK](https://www.postgresql.org/docs/18/sql-rollback.html).

### Where this problem appears in real applications

The same situation occurs when creating an invoice and its lines, registering a participant and occupying a place, or saving an order and its details. If the operation requires them to exist together, an error between writes should not leave an incomplete object.

The boundary depends on that business rule. Saving an order and calling an email API does not make the email transactional: PostgreSQL does not control that external service. A rollback cannot retract an email that has been sent.

Syntactically correct queries are not enough either. If the credit targets a nonexistent account, an `UPDATE` can affect zero rows without throwing an error. The application must check how many rows changed and decide whether it can commit. Atomicity keeps or discards **the work you actually defined**.

## Consistency: you must express the rules

Now imagine a store with one T-shirt available. A request tries to reserve two. If the update leaves stock at `-1`, the operation can be atomic and still be incorrect.

**Consistency** means preserving the rules that define a valid state. Some can be expressed in the database: uniqueness, references between tables, required values or column constraints. Others need business logic and correct concurrency handling.

In our table, `CHECK (available >= 0)` explicitly declares negative stock invalid. PostgreSQL rejects a write that violates it. [Data constraints](https://www.postgresql.org/docs/18/ddl-constraints.html).

<img src="/assets/visuals/database-fundamentals/en/inventory-consistency.svg" alt="The store tries to subtract two T-shirts when only one remains. PostgreSQL computes minus one, rejects the write through CHECK and leaves inventory at one after rollback." width="911" height="1366" loading="lazy" style="width:100%;height:auto" />

_The database can enforce the rule because the schema contains it._

[Open the diagram to enlarge it](/assets/visuals/database-fundamentals/en/inventory-consistency.svg).

Restore the setup and run this file:

File: `transactions/sql/consistency.sql`.

```sql
\set ON_ERROR_STOP off
SET search_path TO concept_examples;

BEGIN;
UPDATE inventory SET available = available - 2 WHERE sku = 'T_SHIRT';
-- CHECK rejects -1. COMMIT on this aborted transaction returns ROLLBACK.
COMMIT;
SELECT * FROM inventory;
```

```bash
docker compose exec -T postgres psql -U lab -d transactions_lab -v ON_ERROR_STOP=1 < sql/setup.sql
docker compose exec -T postgres psql -U lab -d transactions_lab < sql/consistency.sql
```

The update fails with SQLSTATE `23514`, a `CHECK` violation. The block becomes aborted, and its `COMMIT` returns `ROLLBACK`. The final query still shows one unit. The transactions article explains why a `COMMIT` in your code does not always mean that a transaction was committed.

### What the database does not know on its own

The accounts schema prevents negative balances, but **does not declare that a transfer must preserve the sum of both accounts**. If we forget the credit and commit only the debit, both balances satisfy the `CHECK` and the database accepts the operation.

A transaction therefore does not prove that your algorithm is correct. You must define the invariants, implement operations that preserve them and test the relevant paths.

In a store, you can also reserve stock using a conditional update:

```sql
SET search_path TO concept_examples;
UPDATE inventory
SET available = available - 2
WHERE sku = 'T_SHIRT' AND available >= 2
RETURNING available;
```

With the initial setup, this returns zero rows and stock remains at one. That result means the reservation did not happen; the application must communicate it. If it must also create a reservation row, group both steps and commit only after the required quantity has been deducted.

ACID consistency concerns the rules of the data state. Do not confuse it with read guarantees across replicas in a distributed system.

## Isolation: two reads can see different states

Imagine a dashboard that queries a balance, does some other work and then queries it again. Meanwhile, another user adds 5 euros. Should the two reads match?

**Isolation** defines how concurrent transactions interact and which changes they can observe. PostgreSQL defaults to `READ COMMITTED`: each ordinary query gets a snapshot of data committed when that query starts. Two `SELECT` statements in the same transaction can see different values. This is a **non-repeatable read**. [Isolation levels](https://www.postgresql.org/docs/18/transaction-iso.html).

<img src="/assets/visuals/database-fundamentals/en/read-isolation.svg" alt="Session A reads 100 euros in READ COMMITTED. Session B adds five and commits. A second query in A sees 105. With REPEATABLE READ, A would still see 100." width="1040" height="1157" loading="lazy" style="width:100%;height:auto" />

_No uncommitted data is read. The snapshot changes between queries._

[Open the diagram to enlarge it](/assets/visuals/database-fundamentals/en/read-isolation.svg).

The reader opens a transaction and waits between its two queries:

File: `transactions/sql/isolation-reader.sql`.

```sql
SET search_path TO concept_examples;
BEGIN ISOLATION LEVEL :isolation_level;
SELECT balance_minor FROM accounts WHERE id = 1;
\prompt 'Run the writer in terminal B, then press Enter: ' resume
SELECT balance_minor FROM accounts WHERE id = 1;
COMMIT;
```

The writer updates the balance in another session:

File: `transactions/sql/isolation-writer.sql`.

```sql
SET search_path TO concept_examples;
BEGIN;
UPDATE accounts SET balance_minor = balance_minor + 500 WHERE id = 1;
COMMIT;
SELECT balance_minor FROM accounts WHERE id = 1;
```

Reset the data and copy the reader into the container so it can run with interactive input. In **terminal A**:

```bash
docker compose exec -T postgres psql -U lab -d transactions_lab -v ON_ERROR_STOP=1 < sql/setup.sql
docker compose cp sql/isolation-reader.sql postgres:/tmp/isolation-reader.sql
docker compose exec postgres psql -U lab -d transactions_lab -v ON_ERROR_STOP=1 -v isolation_level='READ COMMITTED' -f /tmp/isolation-reader.sql
```

The reader shows `10000` and pauses at the message asking you to run the writer. Leave that terminal open without pressing Enter yet.

In **terminal B**, run:

```bash
docker compose exec -T postgres psql -U lab -d transactions_lab -v ON_ERROR_STOP=1 < sql/isolation-writer.sql
```

Return to A and press Enter. The file runs the second `SELECT` and then `COMMIT;`. The first read shows `10000` and the second `10500`.

To repeat the experiment at another level, run the setup after A finishes, then rerun the reader command with `isolation_level='REPEATABLE READ'` instead of `isolation_level='READ COMMITTED'`. Run the writer again when prompted. The first query establishes that transaction's snapshot; the second still sees `10000`, even though B has already committed `10500`.

### When the isolation level matters

This arises in reports whose multiple queries must describe the same point in time, in calculations that read before writing, and in concurrent reservations for a scarce resource.

`REPEATABLE READ` stabilizes the reader's view, but does not make every rule across multiple rows correct. `SERIALIZABLE` can detect executions that are not equivalent to a sequential order and abort a transaction; the application must be able to retry **the complete unit** when appropriate. The guarantee of equivalence to that order is called serializability.

Row locks, conditional updates and constraints are also part of the solution. Choosing a stricter level has costs and may require retries. There is no universal choice for every case. [REPEATABLE READ details](https://www.postgresql.org/docs/18/transaction-iso.html#XACT-REPEATABLE-READ), [SERIALIZABLE](https://www.postgresql.org/docs/18/transaction-iso.html#XACT-SERIALIZABLE).

## Durability: what an acknowledged save means

An editor displays “saved” after receiving the commit acknowledgement. A moment later, the server crashes. When we reopen the document, we expect to find the committed version.

**Durability** is the guarantee that committed data survives the failures covered by the system and its configuration.

PostgreSQL uses **Write-Ahead Logging**, or WAL. It records information needed to recover changes before writing the corresponding data pages. Recovery can replay those records if the changes had not yet reached the table files. Committing does not require immediately writing every modified page. [How WAL works](https://www.postgresql.org/docs/18/wal-intro.html).

<img src="/assets/visuals/database-fundamentals/en/wal-durability.svg" alt="Changes generate WAL. With fsync and synchronous_commit enabled, acknowledgement waits for local WAL persistence. After a crash, PostgreSQL can recover changes using the log." width="796" height="1246" loading="lazy" style="width:100%;height:auto" />

_Conceptual local-persistence flow; this does not depict a power-cut experiment or a replica._

[Open the diagram to enlarge it](/assets/visuals/database-fundamentals/en/wal-durability.svg).

Reset the data and save a document:

File: `transactions/sql/durability.sql`.

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

In this lab, `fsync`, `synchronous_commit` and `full_page_writes` are `on`. The document still contains `committed version` after the restart.

**This experiment checks persistence after a clean restart.** It does not, by itself, demonstrate recovery after a power cut or tolerance of disk loss. The diagram explains the mechanism; the experiment has a narrower scope.

### What to check in a real system

With `synchronous_commit = on`, acknowledgement waits for persisted local WAL. Disabling it can allow recent commits to be lost after a crash. Disabling `fsync` can compromise database integrity. You also rely on storage honoring persistence operations. [WAL configuration](https://www.postgresql.org/docs/18/runtime-config-wal.html), [storage reliability](https://www.postgresql.org/docs/18/wal-reliability.html).

Durability does not replace backups either: a committed deletion can be perfectly durable and still be a mistake you want to recover from.

## How to apply ACID when designing an operation

Before implementing an operation with multiple writes, ask these questions using concrete data:

1. **What must be committed together?** For example, an invoice and its lines.
2. **Which states are invalid?** Negative stock, missing references or duplicate identifiers.
3. **Who can change the data concurrently?** Which reads need the same view, and which conflicts must be resolved?
4. **What acknowledgement does the user need?** What persistence does the configuration provide, and what recovery does the business require?
5. **Which effects leave the database?** Emails, files in another service and HTTP calls need additional coordination.

## Common questions about ACID

### Does a transaction prevent all incorrect data?

No. It groups changes, but the rules must be modeled and the code must apply them. Our debit without a credit can violate the example's rule without violating any column constraint.

### Does BEGIN prevent the data I read from changing?

It depends on isolation. In `READ COMMITTED`, the two `SELECT` statements can see different commits. The two-terminal experiment lets you observe this.

### Does ROLLBACK reverse an earlier COMMIT?

No. It discards pending work in that transaction. Correcting a committed operation requires another operation with its own rules and checks.

When finished, remove **this local lab's container and volumes**:

```bash
docker compose down --volumes
```

To keep practicing, continue with [PostgreSQL transactions: BEGIN, COMMIT, ROLLBACK and SAVEPOINT](/en/posts/postgresql-transactions-practical-examples). We will look at what to do when an SQL error aborts the block and how to preserve part of the work with a savepoint.
