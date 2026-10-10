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
