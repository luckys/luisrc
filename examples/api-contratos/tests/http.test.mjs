import test from 'node:test'
import assert from 'node:assert/strict'
import { createApi } from '../server.mjs'

async function fixture(t) {
  const server = createApi()
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  t.after(
    () =>
      new Promise((resolve) => {
        server.close(resolve)
        server.closeIdleConnections()
      }),
  )
  const base = `http://127.0.0.1:${server.address().port}`
  return (path, method = 'GET', body) =>
    fetch(base + path, {
      method,
      ...(body === undefined
        ? {}
        : {
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          }),
    })
}
const order = { amountMinor: 1250, currency: 'EUR', label: 'Libro' }

test('label cuenta code points Unicode como el contrato, no unidades UTF-16', async (t) => {
  const request = await fixture(t)
  assert.equal(
    (await request('/orders', 'POST', { ...order, label: '😀'.repeat(80) })).status,
    201,
  )
  assert.equal(
    (await request('/orders', 'POST', { ...order, label: '😀'.repeat(81) })).status,
    422,
  )
})

test('contrato: crear devuelve recurso consultable, Location y copia serializada', async (t) => {
  const request = await fixture(t)
  const response = await request('/orders', 'POST', order)
  assert.equal(response.status, 201)
  assert.equal(response.headers.get('location'), '/orders/o1')
  assert.match(response.headers.get('content-type'), /^application\/json/)
  assert.deepEqual(await response.json(), { id: 'o1', ...order })
  const first = await request('/orders/o1')
  const second = await request('/orders/o1')
  assert.equal(first.status, 200)
  assert.deepEqual(await first.json(), await second.json())
})

test('PUT sustituye campos de representación y repetir conserva el mismo estado', async (t) => {
  const request = await fixture(t)
  await request('/orders', 'POST', order)
  const replacement = { amountMinor: 2400, currency: 'USD' }
  for (let i = 0; i < 2; i++) {
    const response = await request('/orders/o1', 'PUT', replacement)
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { id: 'o1', ...replacement })
  }
  assert.equal((await request('/orders/missing', 'PUT', replacement)).status, 404)
})

test('PATCH de label: omitir conserva, null elimina, repetir no acumula efectos', async (t) => {
  const request = await fixture(t)
  await request('/orders', 'POST', order)
  assert.equal((await (await request('/orders/o1', 'PATCH', {})).json()).label, 'Libro')
  for (let i = 0; i < 2; i++) {
    const response = await request('/orders/o1', 'PATCH', { label: null })
    assert.equal(response.status, 200)
    assert.equal('label' in (await response.json()), false)
  }
  assert.equal((await request('/orders/o1', 'PATCH', { amountMinor: 1 })).status, 422)
})

test('DELETE es idempotente aunque cambie el código de respuesta', async (t) => {
  const request = await fixture(t)
  await request('/orders', 'POST', order)
  const response = await request('/orders/o1', 'DELETE')
  assert.equal(response.status, 204)
  assert.equal(await response.text(), '')
  assert.equal((await request('/orders/o1', 'DELETE')).status, 404)
  assert.equal((await request('/orders/o1')).status, 404)
})

test('POST no promete deduplicación: dos solicitudes crean dos pedidos', async (t) => {
  const request = await fixture(t)
  assert.equal(
    (await request('/orders', 'POST', order)).headers.get('location'),
    '/orders/o1',
  )
  assert.equal(
    (await request('/orders', 'POST', order)).headers.get('location'),
    '/orders/o2',
  )
})

test('entradas inválidas, método no permitido y ausencia tienen contratos distintos', async (t) => {
  const request = await fixture(t)
  for (const body of [
    null,
    [],
    { amountMinor: -1, currency: 'EUR' },
    { ...order, admin: true },
    { ...order, amountMinor: 1.5 },
  ]) {
    const response = await request('/orders', 'POST', body)
    assert.equal(response.status, 422)
    assert.match(response.headers.get('content-type'), /application\/problem\+json/)
    const problem = await response.json()
    assert.equal(problem.status, 422)
    assert.equal(problem.type, 'about:blank')
    assert.equal('stack' in problem, false)
  }
  const method = await request('/orders', 'DELETE')
  assert.equal(method.status, 405)
  assert.equal(method.headers.get('allow'), 'POST')
  assert.equal((await request('/unknown')).status, 404)
})

test('frontera HTTP: JSON malformado, tipo incorrecto y cuerpo excesivo', async (t) => {
  const server = createApi()
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  t.after(
    () =>
      new Promise((resolve) => {
        server.close(resolve)
        server.closeIdleConnections()
      }),
  )
  const url = `http://127.0.0.1:${server.address().port}/orders`
  assert.equal(
    (
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{',
      })
    ).status,
    400,
  )
  assert.equal((await fetch(url, { method: 'POST', body: '{}' })).status, 415)
  assert.equal(
    (
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ x: 'x'.repeat(5000) }),
      })
    ).status,
    413,
  )
})
