import assert from 'node:assert/strict'
import { firstPageSQL, nextPageSQL, offsetSQL } from './queries.mjs'

function planStats(document) {
  const root = document[0]
  const scans = []
  function visit(node) {
    if (/Scan$/.test(node['Node Type'])) scans.push(node)
    for (const child of node.Plans ?? []) visit(child)
  }
  visit(root.Plan)
  assert.equal(scans.length, 1, 'Revisar protocolo: se esperaba un scan de índice')
  assert.match(scans[0]['Node Type'], /Index/)
  return {
    ms: root['Execution Time'],
    scanOutputRows: scans[0]['Actual Rows'] * scans[0]['Actual Loops'],
    scan: scans[0]['Node Type'],
    plan: document,
  }
}

export async function benchmark(pool, rounds = 7, offset = 300000) {
  const anchor = offset
    ? (await pool.query(offsetSQL, [1, 'paid', 1, offset - 1])).rows[0]
    : null
  const statements = {
    offset: [offsetSQL, [1, 'paid', 50, offset]],
    keyset: anchor
      ? [nextPageSQL, [1, 'paid', anchor.created_at, anchor.id, 50]]
      : [firstPageSQL, [1, 'paid', 50]],
  }
  const ids = await Promise.all(
    Object.values(statements).map(async ([query, values]) =>
      (await pool.query(query, values)).rows.map((row) => row.id),
    ),
  )
  assert.deepEqual(ids[0], ids[1])
  // Una ejecución de calentamiento por estrategia; no se vacían cachés del sistema.
  for (const [query, values] of Object.values(statements)) await pool.query(query, values)
  const samples = []
  for (let index = 0; index < rounds; index++) {
    const sample = {}
    const order = index % 2 ? ['keyset', 'offset'] : ['offset', 'keyset']
    for (const strategy of order) {
      const [query, values] = statements[strategy]
      const result = await pool.query(
        `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query}`,
        values,
      )
      sample[strategy] = planStats(result.rows[0]['QUERY PLAN'])
    }
    samples.push(sample)
  }
  return { offset, pageSize: 50, sameIds: true, anchorCostIncluded: false, samples }
}

export async function concurrentInsert(pool) {
  const reader = await pool.connect()
  const writer = await pool.connect()
  try {
    await reader.query('BEGIN ISOLATION LEVEL READ COMMITTED READ ONLY')
    const pids = await Promise.all([
      reader.query('SELECT pg_backend_pid() AS pid'),
      writer.query('SELECT pg_backend_pid() AS pid'),
    ])
    const first = (await reader.query(firstPageSQL, [1, 'paid', 5])).rows
    const last = first.at(-1)
    await writer.query(
      "INSERT INTO orders (id,tenant_id,status,created_at,amount_minor,currency,description) VALUES (2000001,1,'paid','2030-01-01',1250,'EUR','insercion concurrente')",
    )
    const offset = (await reader.query(offsetSQL, [1, 'paid', 5, 5])).rows
    const keyset = (
      await reader.query(nextPageSQL, [1, 'paid', last.created_at, last.id, 5])
    ).rows
    const overlap = (rows) =>
      rows
        .filter((row) => first.some((previous) => previous.id === row.id))
        .map((row) => row.id)
    return {
      connectionsDistinct: pids[0].rows[0].pid !== pids[1].rows[0].pid,
      first: first.map((x) => x.id),
      offset: offset.map((x) => x.id),
      keyset: keyset.map((x) => x.id),
      offsetOverlap: overlap(offset),
      keysetOverlap: overlap(keyset),
      newRowInKeyset: keyset.some((x) => x.id === '2000001'),
    }
  } finally {
    await reader.query('ROLLBACK')
    await writer.query('DELETE FROM orders WHERE id=2000001')
    reader.release()
    writer.release()
  }
}
