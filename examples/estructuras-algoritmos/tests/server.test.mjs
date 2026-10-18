import test from 'node:test'
import assert from 'node:assert/strict'
import { once } from 'node:events'
import { createExplorerServer } from '../serve.mjs'
import { measure, median } from '../benchmark.mjs'

test('benchmark conserva nueve muestras, rotación y resultados equivalentes', () => {
  const result = measure(20, 10, 'mixed')
  assert.equal(result.samples.length, 9)
  assert.deepEqual(
    result.samples.slice(0, 3).map((row) => row.order[0]),
    ['scan', 'indexed', 'fresh'],
  )
  for (const key of ['scan', 'indexed', 'fresh']) {
    assert.equal(
      result.medians_ms[key],
      median(result.samples.map((row) => row[`${key}_ms`])),
    )
    assert.ok(
      result.samples.every(
        (row) => Number.isFinite(row[`${key}_ms`]) && row[`${key}_ms`] >= 0,
      ),
    )
  }
})

test('explorador local sirve solo su allowlist y cierra los sockets', async () => {
  const server = createExplorerServer()
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const origin = `http://127.0.0.1:${server.address().port}`
  try {
    for (const path of ['/', '/explorer.mjs', '/model.mjs'])
      assert.equal((await fetch(origin + path)).status, 200)
    assert.equal((await fetch(origin + '/algorithms.ts')).status, 404)
    assert.equal((await fetch(origin + '/package.json')).status, 404)
    assert.equal((await fetch(origin, { method: 'POST' })).status, 404)
  } finally {
    await new Promise((resolve) => {
      server.close(resolve)
      server.closeIdleConnections()
    })
  }
})
