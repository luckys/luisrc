SET search_path TO concept_examples;
BEGIN ISOLATION LEVEL :isolation_level;
SELECT balance_minor FROM accounts WHERE id = 1;
\prompt 'Run the writer in terminal B, then press Enter: ' resume
SELECT balance_minor FROM accounts WHERE id = 1;
COMMIT;
