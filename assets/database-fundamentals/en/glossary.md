# Lab glossary

- **Transaction:** unit of work committed or discarded together.
- **Autocommit:** individual commit of successful statements outside an explicit block.
- **Invariant:** rule every valid state must satisfy.
- **Atomicity:** all changes in the block persist or are discarded.
- **Consistency:** preservation of the rules defining a valid state.
- **Isolation:** guarantees governing concurrent transaction interactions.
- **Durability:** retention of commits against failures covered by the configuration.
- **Snapshot:** view of data used by a query or transaction.
- **Savepoint:** point to which a block can roll back while retaining earlier changes.
- **WAL:** log used to recover changes without requiring every data page to be written at commit.
- **Pool:** set of connections; a transaction must stay on one client.
- **SQLSTATE:** stable code identifying a PostgreSQL result or error class.
- **Internal payment record:** demonstration row; its presence does not mean money was charged.
