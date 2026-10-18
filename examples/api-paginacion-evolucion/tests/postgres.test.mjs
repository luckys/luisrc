import test from 'node:test'
import assert from 'node:assert/strict'
import { once } from 'node:events'
import pg from 'pg'
import { firstPageSQL, nextPageSQL, offsetSQL } from '../queries.mjs'
import { createApi } from '../server.mjs'
import { readV1, readV2 } from '../clients.mjs'
import { benchmark, concurrentInsert } from '../experiments.mjs'

if (!process.env.API_LAB_PORT)
  throw new Error('Usa node run.mjs: no conectar una base externa implícitamente')
const pool = new pg.Pool({
  host: '127.0.0.1',
  port: +process.env.API_LAB_PORT,
  user: 'lab',
  password: 'local-only-lab',
  database: 'api_lab',
  max: 4,
})
test.after(() => pool.end())

test('un millón de filas, filtros de tenant/estado y filas con fecha empatada', async () => {
  assert.equal(
    (await pool.query('SELECT count(*)::int AS n FROM orders')).rows[0].n,
    1000000,
  )
  const first = (await pool.query(firstPageSQL, [1, 'paid', 51])).rows
  const after = first[49]
  const keyset = (
    await pool.query(nextPageSQL, [1, 'paid', after.created_at, after.id, 50])
  ).rows
  const offset = (await pool.query(offsetSQL, [1, 'paid', 50, 50])).rows
  assert.deepEqual(
    keyset.map((x) => x.id),
    offset.map((x) => x.id),
  )
  assert.ok(first.some((x, i) => i && +x.created_at === +first[i - 1].created_at))
  assert.ok(first.every((x) => x.tenant_id === 1 && x.status === 'paid'))
})

test('dos conexiones vivas: INSERT entre páginas repite una fila con OFFSET, no con keyset', async () => {
  const result = await concurrentInsert(pool)
  assert.equal(result.connectionsDistinct, true)
  assert.equal(result.offsetOverlap.length, 1)
  assert.equal(result.keysetOverlap.length, 0)
  assert.equal(result.newRowInKeyset, false)
})

test('snapshot REPEATABLE READ no incorpora un INSERT confirmado por otra conexión', async () => {
  const reader = await pool.connect()
  const writer = await pool.connect()
  try {
    await reader.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY')
    const first = (await reader.query(firstPageSQL, [1, 'paid', 5])).rows
    await writer.query(
      "INSERT INTO orders (id,tenant_id,status,created_at,amount_minor,currency,description) VALUES (2000002,1,'paid','2030-01-01',1250,'EUR','snapshot')",
    )
    const second = (await reader.query(offsetSQL, [1, 'paid', 5, 5])).rows
    assert.ok(second.every((x) => !first.some((y) => x.id === y.id)))
    assert.ok(!second.some((x) => x.id === '2000002'))
    await reader.query('COMMIT')
    assert.equal((await reader.query(firstPageSQL, [1, 'paid', 1])).rows[0].id, '2000002')
  } finally {
    await reader.query('ROLLBACK')
    await writer.query('DELETE FROM orders WHERE id=2000002')
    reader.release()
    writer.release()
  }
})

test('planes: mismo resultado profundo, OFFSET visita más filas que keyset', async () => {
  const result = await benchmark(pool, 1)
  assert.equal(result.sameIds, true)
  assert.ok(result.samples[0].offset.scanOutputRows >= 300050)
  assert.ok(result.samples[0].keyset.scanOutputRows <= 51)
})

test('ambos clientes funcionan contra páginas consultadas realmente a PostgreSQL', async () => {
  const server = createApi({ pool })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const origin = `http://127.0.0.1:${server.address().port}`
  try {
    for (const [version, client] of [
      ['v1', readV1],
      ['v2', readV2],
    ]) {
      const page = await (await fetch(`${origin}/${version}/orders?pageSize=2`)).json()
      assert.equal(client(page).length, 2)
      const next = await (
        await fetch(`${origin}/${version}/orders?pageSize=2&after=${page.nextCursor}`)
      ).json()
      assert.ok(next.items.every((x) => !page.items.some((y) => y.id === x.id)))
    }
    const search = await pool.query(
      "SELECT id FROM orders WHERE tenant_id=$1 AND status=$2 AND search @@ websearch_to_tsquery('spanish', $3) LIMIT 5",
      [1, 'paid', 'camara'],
    )
    assert.equal(search.rows.length, 5)
  } finally {
    server.closeIdleConnections()
    await new Promise((resolve) => server.close(resolve))
  }
})

test('keyset no es snapshot: mover una fila ya vista detrás del cursor puede repetirla', async () => {
  const first = (await pool.query(firstPageSQL, [1, 'paid', 5])).rows
  const moved = first[0]
  const last = first.at(-1)
  try {
    await pool.query(
      "UPDATE orders SET created_at=$1::timestamptz - interval '1 millisecond' WHERE id=$2",
      [last.created_at, moved.id],
    )
    const next = (
      await pool.query(nextPageSQL, [1, 'paid', last.created_at, last.id, 20])
    ).rows
    assert.ok(next.some((row) => row.id === moved.id))
  } finally {
    await pool.query('UPDATE orders SET created_at=$1 WHERE id=$2', [
      moved.created_at,
      moved.id,
    ])
  }
})
