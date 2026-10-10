# Database fundamentals lab

Educational ACID and transaction examples with fictional data. Includes standalone SQL and an optional TypeScript extension. The payment rows are internal records, not actual charges.

## Requirements

Docker with Compose. For TypeScript: Node.js >=22.12.0 and pnpm 12.8.1.

## SQL examples

Run from this folder:

```bash
docker compose up -d --wait
docker compose exec -T postgres psql -U lab -d transactions_lab -v ON_ERROR_STOP=1 < sql/setup.sql
docker compose exec -T postgres psql -U lab -d transactions_lab < sql/atomicity.sql
```

Setup resets only the fictional tables in `concept_examples`. Run it before each independent experiment.

- `sql/atomicity.sql`: separate debit, rollback, complete transfer.
- `sql/consistency.sql`: CHECK rejects negative stock.
- `sql/isolation-reader.sql` and `sql/isolation-writer.sql`: repeated reads in two sessions.
- `sql/durability.sql`: commit a document and inspect configuration.
- `sql/transactions.sql`: SAVEPOINT and ROLLBACK.

Some files contain intentional SQL errors and let psql continue so you can inspect the final state. Do not use that setting as a migration policy.

### Two sessions

After setup:

```bash
docker compose cp sql/isolation-reader.sql postgres:/tmp/isolation-reader.sql
docker compose exec postgres psql -U lab -d transactions_lab -v ON_ERROR_STOP=1 -v isolation_level='READ COMMITTED' -f /tmp/isolation-reader.sql
```

At the prompt, run in another terminal:

```bash
docker compose exec -T postgres psql -U lab -d transactions_lab -v ON_ERROR_STOP=1 < sql/isolation-writer.sql
```

Press Enter in the reader: it shows 10000 and 10500. Close it, reset the data and repeat with `isolation_level='REPEATABLE READ'`: it shows 10000 twice.

### Orderly restart

After setup:

```bash
docker compose exec -T postgres psql -U lab -d transactions_lab -v ON_ERROR_STOP=1 < sql/durability.sql
docker compose restart postgres
docker compose up -d --wait
docker compose exec -T postgres psql -U lab -d transactions_lab -c "SELECT * FROM concept_examples.documents;"
```

This checks persistence after an orderly restart, not power loss or disk failure.

## TypeScript extension

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm experiment:atomicity
```

When copying files from the article, run `pnpm install` first to create a lockfile. The ZIP already includes one.

Each run creates and removes its own random schema. The order and internal payment schema deliberately permits negative amounts to demonstrate that a transaction does not invent business rules. No external provider is called.

## Cleanup

```bash
docker compose down --volumes
```

Removes the lab resources, including demonstration data. TypeScript connects to localhost:55434. If you change `TRANSACTIONS_DB_PORT` for Compose, use the same value for tests and the experiment.

See `docs/results.md` for expected results and validation limits.
