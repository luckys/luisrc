# Lab results

Verified: 2026-10-10. Fictional data; not a benchmark or production evidence.

## Environment

Linux x64, Node.js 24.18.0, pnpm 12.8.1, Docker 29.9.0, PostgreSQL 18.4.
Image and digest: `docker-compose.yml`. pg 8.23.1, Vitest 5.0.3, TypeScript 5.9.3.
Observed configuration: `read committed`, `fsync=on`, `synchronous_commit=on`, `full_page_writes=on`.

## SQL expectations

| Experiment                            | Expected state                                     |
| ------------------------------------- | -------------------------------------------------- |
| Autocommit debit followed by error    | 7500 + 5000 = 12500                                |
| Debit in a block followed by rollback | 10000 + 5000 = 15000                               |
| Complete transfer                     | 7500 + 7500 = 15000                                |
| Invalid stock                         | CHECK rejects -1; stock stays at 1                 |
| READ COMMITTED reads                  | 10000, 10500                                       |
| REPEATABLE READ reads                 | 10000, 10000; writer commits 10500                 |
| Document and orderly restart          | `committed version` remains                        |
| Error and savepoint recovery          | Debit and credit commit; document change discarded |

## Nine TypeScript tests

1. Application error without a transaction: one order, zero payments.
2. Application error inside a transaction: no rows.
3. Successful commit: both rows, matching 2500 EUR amounts and internal payment status `created`.
4. SQL error 23505 on the second write: the new order rolls back.
5. Another client cannot see the order before commit.
6. SQL error 22012, aborted block 25P02 and recovery to a savepoint.
7. Connection closes before commit: backend terminates and no rows remain.
8. Negative amount without CHECK: -2500 is allowed, exposing the missing rule.
9. COMMIT on an aborted block returns the ROLLBACK command.

```bash
pnpm check
pnpm test
pnpm experiment:atomicity
```

The experiment prints counts 1/0, 0/0 and 1/1 for the three paths.

## Limits

SQL scripts check specific data and visibility scenarios. The restart is orderly: it does not simulate power loss, faulty storage or failover. Visibility does not demonstrate serializability. Concurrent writers and reconciliation after a lost commit response are not verified.

The extension performs no charges, deliveries or external effects. Atomicity tests do not verify every business rule. No latency or throughput measurements are included.
