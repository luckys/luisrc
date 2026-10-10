\set ON_ERROR_STOP off
SET search_path TO concept_examples;

BEGIN;
UPDATE inventory SET available = available - 2 WHERE sku = 'T_SHIRT';
-- El CHECK rechaza -1. El COMMIT de este bloque abortado devuelve ROLLBACK.
COMMIT;
SELECT * FROM inventory;
