SET search_path TO concept_examples;
BEGIN;
UPDATE accounts SET balance_minor = balance_minor + 500 WHERE id = 1;
COMMIT;
SELECT balance_minor FROM accounts WHERE id = 1;
