import test from 'node:test'
import assert from 'node:assert/strict'
import { once } from 'node:events'
import { createApi } from '../server.mjs'
import { readV1, readV2 } from '../clients.mjs'
const row = {
  id: '1',
  created_at: new Date('2026-01-01T00:00:00.001Z'),
  amount_minor: 1250,
  currency: 'EUR',
  status: 'paid',
  description: 'Libro',
}
async function fixture(t, change = 'additive', pool) {
  const queries = []
  const database = pool ?? {
    async query(text, values) {
      queries.push({ text, values })
      return { rows: [row, { ...row, id: '2' }] }
    },
  }
  const server = createApi({ pool: database, change })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(async () => {
    server.closeIdleConnections()
    await new Promise((resolve) => server.close(resolve))
  })
  return { origin: `http://127.0.0.1:${server.address().port}`, queries }
}

test('dos clientes independientes consumen /v1 y /v2 por HTTP durante la transición', async (t) => {
  for (const change of ['baseline', 'additive']) {
    const { origin } = await fixture(t, change)
    const old = await fetch(`${origin}/v1/orders?pageSize=1`)
    assert.deepEqual(readV1(await old.json()), [1250])
    const current = await fetch(`${origin}/v2/orders?pageSize=1`)
    assert.deepEqual(readV2(await current.json()), [1250])
    assert.equal(current.headers.get('Deprecation'), null)
    assert.ok(old.headers.get('Deprecation').startsWith('@'))
    assert.match(old.headers.get('Sunset'), /GMT$/)
    assert.match(old.headers.get('Link'), /rel="deprecation"/)
    assert.equal((await fetch(`${origin}/migration/v2`)).status, 200)
  }
})

test('contract test detecta una regresión servida por HTTP, aunque JSON y status sean válidos', async (t) => {
  const { origin } = await fixture(t, 'breaking')
  const response = await fetch(`${origin}/v1/orders`)
  assert.equal(response.status, 200)
  const body = await response.json()
  assert.throws(() => readV1(body), /contract_v1/)
})

test('cursor se toma de la última fila entregada, no de la fila lookahead', async (t) => {
  const { origin, queries } = await fixture(t)
  const first = await (await fetch(`${origin}/v1/orders?pageSize=1`)).json()
  assert.equal(first.items.length, 1)
  const second = await fetch(`${origin}/v1/orders?pageSize=1&after=${first.nextCursor}`)
  assert.equal(second.status, 200)
  await second.json()
  assert.equal(queries[1].values[3], '1')
  assert.equal(queries[1].values.at(-1), 2)
  assert.equal((await fetch(`${origin}/v2/orders?after=${first.nextCursor}`)).status, 400)
})

test('query inválida no llega a SQL y una excepción SQL no se divulga', async (t) => {
  const { origin, queries } = await fixture(t)
  assert.equal((await fetch(`${origin}/v1/orders?status=paid%27`)).status, 400)
  assert.equal(queries.length, 0)
  const broken = await fixture(t, 'additive', {
    async query() {
      throw new Error('SQL password=secret')
    },
  })
  const response = await fetch(`${broken.origin}/v1/orders`)
  assert.equal(response.status, 500)
  assert.ok(!(await response.text()).includes('secret'))
})
