SET search_path TO concept_examples;
BEGIN;
UPDATE documents SET body = 'committed version' WHERE id = 1;
COMMIT;
SELECT * FROM documents;
SHOW fsync;
SHOW synchronous_commit;
SHOW full_page_writes;
