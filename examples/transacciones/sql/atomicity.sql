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
