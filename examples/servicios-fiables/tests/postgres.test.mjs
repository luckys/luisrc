import test from 'node:test'
import assert from 'node:assert/strict'
import { sql, sqlFile, sqlAsync } from '../tools/database.mjs'

test('PostgreSQL: operación, clave y evento se confirman juntos', () => {
  sqlFile('01-schema.sql')
  sqlFile('02-atomic-write.sql')
  assert.equal(sql('SELECT count(*) FROM reliable_lab.outbox'), '1')
  assert.throws(() =>
    sql(
      "BEGIN; INSERT INTO reliable_lab.operations VALUES ('o2',100,'EUR','processing',1); INSERT INTO reliable_lab.outbox(id,operation_id,type) VALUES ('e1','o2','duplicate'); COMMIT;",
    ),
  )
  assert.equal(sql("SELECT count(*) FROM reliable_lab.operations WHERE id='o2'"), '0')
})

test('PostgreSQL: UNIQUE coordina 20 conexiones y el fingerprint no cambia', async () => {
  sqlFile('01-schema.sql')
  sql("INSERT INTO reliable_lab.operations VALUES ('o1',1200,'EUR','processing',1)")
  const results = await Promise.all(
    Array.from({ length: 20 }, () =>
      sqlAsync(
        "INSERT INTO reliable_lab.idempotency VALUES ('tenant:a:create','key1','EUR:1200','o1') ON CONFLICT DO NOTHING RETURNING operation_id",
      ),
    ),
  )
  assert.equal(results.filter(Boolean).length, 1)
  assert.equal(
    sql(
      "SELECT fingerprint FROM reliable_lab.idempotency WHERE scope='tenant:a:create' AND key='key1'",
    ),
    'EUR:1200',
  )
})

test('PostgreSQL: crash tras publicar permite redelivery sin duplicar proyección', () => {
  sqlFile('01-schema.sql')
  sqlFile('02-atomic-write.sql')
  sqlFile('03-consume.sql')
  // Se omitió marcar published_at: representa caída después de la entrega.
  assert.equal(
    sql('SELECT count(*) FROM reliable_lab.outbox WHERE published_at IS NULL'),
    '1',
  )
  sqlFile('03-consume.sql')
  assert.equal(
    sql("SELECT notifications FROM reliable_lab.projection WHERE operation_id='o1'"),
    '1',
  )
  sql("UPDATE reliable_lab.outbox SET published_at=clock_timestamp() WHERE id='e1'")
  assert.equal(
    sql('SELECT count(*) FROM reliable_lab.outbox WHERE published_at IS NULL'),
    '0',
  )
})

test('PostgreSQL: rollback revierte también el dedup del consumidor', () => {
  sqlFile('01-schema.sql')
  assert.throws(() =>
    sql(
      "BEGIN; INSERT INTO reliable_lab.inbox VALUES ('worker','e2'); SELECT 1/0; COMMIT;",
    ),
  )
  assert.equal(sql('SELECT count(*) FROM reliable_lab.inbox'), '0')
})
