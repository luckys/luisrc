\ir 07-indices.sql
EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON)
SELECT id FROM db_perf.events WHERE tenant_id=42;
EXPLAIN (ANALYZE,BUFFERS)
SELECT id FROM db_perf.events WHERE tenant_id>=0;
SELECT attname,n_distinct FROM pg_stats
WHERE schemaname='db_perf' AND tablename='events';
