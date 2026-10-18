import test from 'node:test'
import assert from 'node:assert/strict'
import { once } from 'node:events'
import { createApi } from '../server.mjs'
import { createInventory } from '../service.mjs'
import { ApiError } from '../problems.mjs'

async function fixture(t, options = {}) {
  const logs = []
  const server = createApi({ logger: (entry) => logs.push(entry), ...options })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(async () => {
    server.closeIdleConnections()
    await new Promise((resolve) => server.close(resolve))
  })
  const origin = `http://127.0.0.1:${server.address().port}`
  async function post(body, headers = {}) {
    const response = await fetch(`${origin}/reservations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    })
    return { response, body: await response.json() }
  }
  return { post, logs, origin }
}
const command = { sku: 'BOOK', quantity: 2, expectedVersion: 1, priority: 'standard' }

test('HTTP: JSON roto, campos inválidos y stock/versiones tienen códigos distinguibles', async (t) => {
  const { post, logs } = await fixture(t)
  for (const [input, status, code] of [
    ['{', 400, 'malformed_json'],
    [{ ...command, quantity: '2' }, 422, 'invalid_input'],
    [command, 200, undefined],
    [command, 409, 'version_conflict'],
    [{ ...command, expectedVersion: 2 }, 409, 'out_of_stock'],
  ]) {
    const result = await post(input)
    assert.equal(result.response.status, status)
    if (code) {
      assert.equal(result.body.code, code)
      assert.equal(result.body.status, status)
      assert.equal(
        result.response.headers.get('Content-Type'),
        'application/problem+json',
      )
      assert.equal(result.body.type, `urn:api-lab:problem:${code}`)
    }
    assert.match(result.response.headers.get('X-Request-Id'), /^[0-9a-f-]{36}$/)
  }
  assert.equal(logs.length, 5)
})

test('dos clientes con la misma versión: una reserva, un conflicto, ningún descuento doble', async (t) => {
  const inventory = createInventory()
  const { post } = await fixture(t, { inventory })
  const results = await Promise.all([post(command), post(command)])
  assert.deepEqual(results.map((x) => x.response.status).sort(), [200, 409])
  assert.equal(
    results.find((x) => x.response.status === 409).body.code,
    'version_conflict',
  )
  assert.deepEqual(inventory.get('BOOK'), { stock: 1, version: 2 })
})

test('errores múltiples no reflejan valores, nombres arbitrarios ni Authorization en logs', async (t) => {
  const { post, logs } = await fixture(t)
  const result = await post(
    {
      sku: 'private-secret',
      quantity: -1,
      expectedVersion: '1',
      priority: 'invalid',
      'hidden-secret': true,
    },
    { Authorization: 'Bearer token-secret', 'X-Request-Id': 'attacker-secret' },
  )
  assert.equal(result.response.status, 422)
  assert.equal(result.body.errors.length, 5)
  assert.ok(!JSON.stringify([result.body, logs]).includes('secret'))
  assert.equal(result.body.requestId, logs[0].requestId)
  assert.equal(result.body.instance, `urn:uuid:${result.body.requestId}`)
  assert.deepEqual(Object.keys(logs[0]).sort(), [
    'code',
    'method',
    'requestId',
    'route',
    'status',
  ])
})

test('causa inesperada produce 500 seguro; fallo temporal conocido produce 503', async (t) => {
  for (const [error, status, code] of [
    [new Error('SQL password=secret at /private/file'), 500, 'internal_error'],
    [new ApiError('dependency_unavailable'), 503, 'dependency_unavailable'],
  ]) {
    const inventory = {
      get() {
        throw error
      },
    }
    const { post, logs } = await fixture(t, { inventory })
    const result = await post(command)
    assert.equal(result.response.status, status)
    assert.equal(result.body.code, code)
    assert.equal(logs[0].code, code)
    assert.ok(!JSON.stringify([result.body, logs]).includes('secret'))
    assert.ok(!('stack' in result.body))
  }
})

test('transporte: media type, UTF-8 inválido, tamaño y ruta fija de logs', async (t) => {
  const { post, origin, logs } = await fixture(t)
  assert.equal(
    (await post(command, { 'Content-Type': 'text/plain' })).response.status,
    415,
  )
  assert.equal((await post('x'.repeat(4097))).response.status, 413)
  const invalid = await fetch(`${origin}/reservations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: Buffer.from([0xff]),
  })
  assert.equal(invalid.status, 400)
  await invalid.json()
  const absent = await fetch(`${origin}/private-secret?token=private-secret`)
  assert.equal(absent.status, 404)
  await absent.json()
  assert.equal(logs.at(-1).route, 'unmatched')
  assert.ok(!JSON.stringify(logs).includes('secret'))
})

test('fallo del logger no convierte una reserva completada en una segunda respuesta', async (t) => {
  const { post } = await fixture(t, {
    logger() {
      throw new Error('sink unavailable')
    },
  })
  assert.equal((await post(command)).response.status, 200)
})
