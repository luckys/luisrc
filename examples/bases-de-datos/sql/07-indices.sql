DROP SCHEMA IF EXISTS db_perf CASCADE;
CREATE SCHEMA db_perf;
CREATE TABLE db_perf.events (
  id integer PRIMARY KEY,
  tenant_id integer NOT NULL,
  created_at timestamp NOT NULL,
  status text NOT NULL,
  payload text NOT NULL
);
INSERT INTO db_perf.events
SELECT n,n%1000,timestamp '2026-01-01'+n*interval '1 minute',
  CASE WHEN n%100=0 THEN 'pending' ELSE 'done' END,repeat('x',100)
FROM generate_series(1,100000) AS n;
ANALYZE db_perf.events;
EXPLAIN (ANALYZE,BUFFERS)
SELECT id FROM db_perf.events WHERE tenant_id=42;
CREATE INDEX events_tenant ON db_perf.events(tenant_id);
EXPLAIN (ANALYZE,BUFFERS)
SELECT id FROM db_perf.events WHERE tenant_id=42;
SELECT pg_relation_size('db_perf.events_tenant') AS index_bytes;
