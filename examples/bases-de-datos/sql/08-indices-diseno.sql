\ir 07-indices.sql
CREATE INDEX events_tenant_date ON db_perf.events(tenant_id,created_at DESC) INCLUDE (status);
CREATE INDEX events_pending ON db_perf.events(created_at) WHERE status='pending';
EXPLAIN (ANALYZE,BUFFERS)
SELECT created_at,status FROM db_perf.events
WHERE tenant_id=42 ORDER BY created_at DESC LIMIT 10;
EXPLAIN (ANALYZE,BUFFERS)
SELECT id FROM db_perf.events WHERE status='pending' ORDER BY created_at LIMIT 10;
