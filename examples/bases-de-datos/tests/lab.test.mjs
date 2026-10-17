import test from 'node:test'
import assert from 'node:assert/strict'
import { session, sqlFile, redis } from '../tools/database.mjs'

test('integridad: se rechazan datos inválidos y se conserva la cardinalidad', async () => {
  sqlFile('01-modelo.sql')
  const db = session()
  try {
    assert.equal(await db.query('SELECT count(*) FROM db_model.order_items'), '3')
    await assert.rejects(
      db.query("INSERT INTO db_model.orders VALUES (99,999,'EUR','2026-01-01')"),
      /23503/,
    )
    await assert.rejects(
      db.query("INSERT INTO db_model.products VALUES ('BAD','Inválido',-1)"),
      /23514/,
    )
    await assert.rejects(
      db.query(
        "INSERT INTO db_model.customers VALUES (4,'Duplicado','ana@example.test')",
      ),
      /23505/,
    )
    await assert.rejects(
      db.query("INSERT INTO db_model.order_items VALUES (10,'BOOK',0,1000)"),
      /23514/,
    )
  } finally {
    await db.close()
  }
})

test('MVCC: instantáneas distintas en READ COMMITTED y estables en REPEATABLE READ', async () => {
  for (const [level, expected] of [
    ['READ COMMITTED', '10500'],
    ['REPEATABLE READ', '10000'],
  ]) {
    sqlFile('02-aislamiento.sql')
    const a = session(),
      b = session()
    try {
      await a.query(`BEGIN ISOLATION LEVEL ${level}`)
      assert.equal(
        await a.query('SELECT balance FROM db_isolation.accounts WHERE id=1'),
        '10000',
      )
      await b.query('UPDATE db_isolation.accounts SET balance=10500 WHERE id=1')
      assert.equal(
        await a.query('SELECT balance FROM db_isolation.accounts WHERE id=1'),
        expected,
      )
      await a.query('COMMIT')
    } finally {
      await a.close()
      await b.close()
    }
  }
})

test('write skew: REPEATABLE READ permite romper la regla y SERIALIZABLE rechaza una transacción', async () => {
  for (const level of ['REPEATABLE READ', 'SERIALIZABLE']) {
    sqlFile('02-aislamiento.sql')
    const a = session(),
      b = session()
    try {
      await a.query(`BEGIN ISOLATION LEVEL ${level}`)
      await b.query(`BEGIN ISOLATION LEVEL ${level}`)
      assert.equal(
        await a.query('SELECT count(*) FROM db_isolation.on_call WHERE active'),
        '2',
      )
      assert.equal(
        await b.query('SELECT count(*) FROM db_isolation.on_call WHERE active'),
        '2',
      )
      await a.query('UPDATE db_isolation.on_call SET active=false WHERE id=1')
      await b.query('UPDATE db_isolation.on_call SET active=false WHERE id=2')
      await a.query('COMMIT')
      if (level === 'SERIALIZABLE') await assert.rejects(b.query('COMMIT'), /40001/)
      else await b.query('COMMIT')
      assert.equal(
        await a.query('SELECT count(*) FROM db_isolation.on_call WHERE active'),
        level === 'SERIALIZABLE' ? '1' : '0',
      )
    } finally {
      await a.close()
      await b.close()
    }
  }
})

test('concurrencia: lectura y escritura separadas pierden una actualización; UPDATE condicional no', async () => {
  sqlFile('03-concurrencia.sql')
  const a = session(),
    b = session()
  try {
    assert.equal(
      await a.query('SELECT available FROM db_concurrency.stock WHERE id=1'),
      '1',
    )
    assert.equal(
      await b.query('SELECT available FROM db_concurrency.stock WHERE id=1'),
      '1',
    )
    await a.query('UPDATE db_concurrency.stock SET available=0 WHERE id=1')
    await b.query('UPDATE db_concurrency.stock SET available=0 WHERE id=1')
    await a.query('UPDATE db_concurrency.stock SET available=1 WHERE id=1')
    const results = await Promise.all([
      a.query(
        'UPDATE db_concurrency.stock SET available=available-1 WHERE id=1 AND available>0 RETURNING available',
      ),
      b.query(
        'UPDATE db_concurrency.stock SET available=available-1 WHERE id=1 AND available>0 RETURNING available',
      ),
    ])
    assert.deepEqual(results.sort(), ['', '0'])
    const versions = await Promise.all([
      a.query(
        'UPDATE db_concurrency.stock SET version=version+1 WHERE id=1 AND version=1 RETURNING version',
      ),
      b.query(
        'UPDATE db_concurrency.stock SET version=version+1 WHERE id=1 AND version=1 RETURNING version',
      ),
    ])
    assert.deepEqual(versions.sort(), ['', '2'])
  } finally {
    await a.close()
    await b.close()
  }
})

test('SQL: JOIN ingenuo duplica importes; preagregación y ventanas respetan el grano', async () => {
  sqlFile('04-consultas.sql')
  sqlFile('05-analitica.sql')
  const db = session()
  try {
    assert.equal(
      await db.query(
        'SELECT sum(total_minor) FROM db_model.orders o JOIN db_model.order_totals t ON t.order_id=o.id JOIN db_model.order_items i ON i.order_id=o.id',
      ),
      '6500',
    )
    assert.equal(
      await db.query('SELECT sum(total_minor) FROM db_model.order_totals'),
      '3500',
    )
    assert.equal(await db.query('SELECT count(*) FROM db_model.customer_totals'), '3')
    assert.equal(
      await db.query(
        'SELECT cumulative_minor FROM db_model.order_analysis ORDER BY created_at DESC,id DESC LIMIT 1',
      ),
      '3500',
    )
  } finally {
    await db.close()
  }
})

test('LEFT JOIN conserva clientes al filtrar en ON y EXISTS evita multiplicarlos', async () => {
  sqlFile('04-consultas.sql')
  const db = session()
  try {
    assert.equal(
      await db.query(
        `SELECT c.id,coalesce(sum(t.total_minor),0) FROM db_model.customers c LEFT JOIN db_model.orders o ON o.customer_id=c.id AND o.created_at>='2026-02-01' AND o.created_at<'2026-03-01' LEFT JOIN db_model.order_totals t ON t.order_id=o.id GROUP BY c.id ORDER BY c.id`,
      ),
      '1|500\n2|0\n3|0',
    )
    assert.equal(
      await db.query(
        'SELECT c.id FROM db_model.customers c WHERE EXISTS (SELECT 1 FROM db_model.orders o WHERE o.customer_id=c.id) ORDER BY c.id',
      ),
      '1',
    )
    assert.equal(
      await db.query(
        'SELECT c.id,count(*),count(o.id) FROM db_model.customers c LEFT JOIN db_model.orders o ON o.customer_id=c.id GROUP BY c.id ORDER BY c.id',
      ),
      '1|2|2\n2|1|0\n3|1|0',
    )
  } finally {
    await db.close()
  }
})

test('FOR UPDATE no bloquea un SELECT ordinario pero sí otro lock incompatible', async () => {
  sqlFile('03-concurrencia.sql')
  const a = session(),
    b = session()
  try {
    await a.query('BEGIN')
    await a.query('SELECT available FROM db_concurrency.stock WHERE id=1 FOR UPDATE')
    assert.equal(
      await b.query('SELECT available FROM db_concurrency.stock WHERE id=1'),
      '1',
    )
    await b.query('BEGIN')
    await assert.rejects(
      b.query('SELECT available FROM db_concurrency.stock WHERE id=1 FOR UPDATE NOWAIT'),
      /55P03/,
    )
    await b.query('ROLLBACK')
    await a.query('COMMIT')
    assert.equal(
      await b.query(
        'SELECT available FROM db_concurrency.stock WHERE id=1 FOR UPDATE NOWAIT',
      ),
      '1',
    )
  } finally {
    await a.close()
    await b.close()
  }
})

test('ON CONFLICT deja una sola reserva y comunica la inserción no realizada', async () => {
  sqlFile('03-concurrencia.sql')
  const a = session(),
    b = session()
  try {
    const results = await Promise.all([
      a.query(
        'INSERT INTO db_concurrency.reservations VALUES (100,7) ON CONFLICT (resource_id) DO NOTHING RETURNING resource_id',
      ),
      b.query(
        'INSERT INTO db_concurrency.reservations VALUES (100,8) ON CONFLICT (resource_id) DO NOTHING RETURNING resource_id',
      ),
    ])
    assert.deepEqual(results.sort(), ['', '100'])
    assert.equal(await a.query('SELECT count(*) FROM db_concurrency.reservations'), '1')
  } finally {
    await a.close()
    await b.close()
  }
})

test('deadlock: PostgreSQL aborta uno de los ciclos de locks', async () => {
  sqlFile('03-concurrencia.sql')
  const a = session(),
    b = session(),
    observer = session()
  try {
    const pid = await a.query('SELECT pg_backend_pid()')
    await a.query('BEGIN')
    await b.query('BEGIN')
    await a.query('SELECT id FROM db_concurrency.stock WHERE id=1 FOR UPDATE')
    await b.query('SELECT id FROM db_concurrency.stock WHERE id=2 FOR UPDATE')
    const waiting = a
      .query('SELECT id FROM db_concurrency.stock WHERE id=2 FOR UPDATE')
      .then(
        () => null,
        (error) => error,
      )
    const deadline = Date.now() + 5000
    while (
      (await observer.query(`SELECT cardinality(pg_blocking_pids(${pid}))`)) === '0'
    ) {
      assert.ok(Date.now() < deadline, 'A debe estar esperando el lock de B')
    }
    const cycle = b
      .query('SELECT id FROM db_concurrency.stock WHERE id=1 FOR UPDATE')
      .then(
        () => null,
        (error) => error,
      )
    const outcomes = await Promise.all([waiting, cycle])
    assert.equal(
      outcomes.filter((error) => error && /40P01/.test(error.message)).length,
      1,
    )
  } finally {
    await a.close()
    await b.close()
    await observer.close()
  }
})

test('normalización: el resumen puede quedar obsoleto y el refresh lo reconcilia', async () => {
  sqlFile('06-normalizacion.sql')
  const db = session()
  try {
    assert.equal(
      await db.query(
        'SELECT total_minor FROM db_model.customer_summary WHERE customer_id=1',
      ),
      '3500',
    )
    await db.query(
      "UPDATE db_model.order_items SET quantity=3 WHERE order_id=10 AND sku='BOOK'",
    )
    assert.equal(
      await db.query(
        'SELECT total_minor FROM db_model.customer_summary WHERE customer_id=1',
      ),
      '3500',
    )
    await db.query('REFRESH MATERIALIZED VIEW db_model.customer_summary')
    assert.equal(
      await db.query(
        'SELECT total_minor FROM db_model.customer_summary WHERE customer_id=1',
      ),
      '4500',
    )
  } finally {
    await db.close()
  }
})

test('índices, planes y migraciones: scripts completos ejecutables', async () => {
  for (const file of [
    '07-indices.sql',
    '08-indices-diseno.sql',
    '09-planes.sql',
    '10-migraciones.sql',
  ])
    sqlFile(file)
  const db = session()
  try {
    assert.equal(
      await db.query(
        'SELECT count(*) FROM db_migration.profiles WHERE display_name IS NULL',
      ),
      '0',
    )
    await assert.rejects(
      db.query('INSERT INTO db_migration.profiles (id,display_name) VALUES (3,NULL)'),
      /23502/,
    )
  } finally {
    await db.close()
  }
})

test('particionado: límites semiabiertos, unicidad y separación conservando datos', async () => {
  sqlFile('11-particionado.sql')
  const db = session()
  try {
    assert.equal(
      await db.query(
        "SELECT tableoid::regclass::text FROM db_partition.events WHERE occurred_on='2026-02-01'",
      ),
      'db_partition.events_202602',
    )
    await assert.rejects(
      db.query("INSERT INTO db_partition.events VALUES (3,'2026-03-01','fuera')"),
      /23514/,
    )
    await db.query(
      'ALTER TABLE db_partition.events DETACH PARTITION db_partition.events_202601',
    )
    assert.equal(await db.query('SELECT count(*) FROM db_partition.events'), '1')
    assert.equal(await db.query('SELECT count(*) FROM db_partition.events_202601'), '1')
  } finally {
    await db.close()
  }
})

test('Redis: invalidar no impide que una lectura antigua repueble la caché', async () => {
  sqlFile('12-cache.sql')
  const db = session()
  const key = 'db-series:product:1'
  try {
    const old = await db.query('SELECT price_minor FROM db_cache.products WHERE id=1')
    await db.query('UPDATE db_cache.products SET price_minor=1200 WHERE id=1')
    redis('DEL', key)
    redis('SET', key, old, 'EX', '60')
    assert.equal(redis('GET', key), '1000')
    assert.equal(
      await db.query('SELECT price_minor FROM db_cache.products WHERE id=1'),
      '1200',
    )
    assert.ok(Number(redis('TTL', key)) > 0)
  } finally {
    redis('DEL', key)
    await db.close()
  }
})

test('almacenamiento: proyección JSON no sustituye a las constraints relacionales', () => {
  sqlFile('13-motores.sql')
})
