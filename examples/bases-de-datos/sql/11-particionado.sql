DROP SCHEMA IF EXISTS db_partition CASCADE;
CREATE SCHEMA db_partition;
CREATE TABLE db_partition.events (
  id bigint NOT NULL,
  occurred_on date NOT NULL,
  body text NOT NULL,
  PRIMARY KEY (occurred_on,id)
) PARTITION BY RANGE (occurred_on);
CREATE TABLE db_partition.events_202601 PARTITION OF db_partition.events
  FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
CREATE TABLE db_partition.events_202602 PARTITION OF db_partition.events
  FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
INSERT INTO db_partition.events VALUES (1,'2026-01-31','enero'),(2,'2026-02-01','febrero');
EXPLAIN (COSTS OFF)
SELECT * FROM db_partition.events
WHERE occurred_on>='2026-02-01' AND occurred_on<'2026-03-01';
SELECT tableoid::regclass, * FROM db_partition.events ORDER BY occurred_on;
