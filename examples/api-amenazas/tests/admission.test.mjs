import nodeTest from 'node:test'
import assert from 'node:assert/strict'
import { createAdmission, createBulkhead, createTokenBucket } from '../admission.mjs'
import { startLab } from '../lab.mjs'
import { startDestinations, fixedResolver } from '../destinations.mjs'
import { createImporter } from '../importer.mjs'
const test = (name, run) => nodeTest(name, { timeout: 5000 }, run)

const deferred = () => {
  let resolve, reject
  const promise = new Promise((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}
async function call(
  lab,
  {
    tenant = 'north',
    token = 'demo-alice',
    headers = {},
    body = { reference: 'a1' },
  } = {},
) {
  const response = await fetch(`${lab.origin}/tenants/${tenant}/imports`, {
    method: 'POST',
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      'content-type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  })
  return {
    status: response.status,
    retryAfter: response.headers.get('retry-after'),
    body: await response.json(),
  }
}
async function fixture(t, { worker = async () => ({ text: 'OK' }), config = {} } = {}) {
  let time = 0
  const admission = createAdmission({ now: () => time, ...config })
  const lab = await startLab({ importer: worker, admission })
  t.after(() => lab.close())
  return {
    lab,
    admission,
    advance: (ms) => {
      time += ms
    },
  }
}

test('T06: bulkhead distingue cupo del tenant y capacidad global; release es idempotente', () => {
  const bulkhead = createBulkhead({
    tenants: ['north', 'south'],
    perTenant: 1,
    global: 1,
  })
  const release = bulkhead.acquire('north')
  assert.deepEqual(bulkhead.snapshot(), { total: 1, tenants: { north: 1, south: 0 } })
  assert.throws(() => bulkhead.acquire('north'), { status: 429 })
  assert.throws(() => bulkhead.acquire('south'), { status: 503 })
  release()
  release()
  assert.equal(bulkhead.snapshot().total, 0)
  const releaseSouth = bulkhead.acquire('south')
  releaseSouth()
  assert.throws(() => bulkhead.acquire('invented'), { status: 403 })
})

test('T06: ráfaga de cuatro, recarga parcial, coste y techo del token bucket', () => {
  let time = 0
  const bucket = createTokenBucket({ capacity: 4, refillPerSecond: 1, now: () => time })
  assert.deepEqual(bucket.take(2), { allowed: true, remaining: 2, retryAfter: 0 })
  assert.equal(bucket.take(2).remaining, 0)
  assert.deepEqual(bucket.take(), { allowed: false, remaining: 0, retryAfter: 1 })
  time = 500
  assert.deepEqual(bucket.take(), { allowed: false, remaining: 0.5, retryAfter: 1 })
  time = 1000
  assert.equal(bucket.take().allowed, true)
  time = 100000
  assert.deepEqual(bucket.take(), { allowed: true, remaining: 3, retryAfter: 0 })
})

test('T06: reloj retrasado no crea una recarga doble y parámetros inválidos no crean buckets', () => {
  let time = 1000
  const bucket = createTokenBucket({ capacity: 1, refillPerSecond: 1, now: () => time })
  bucket.take()
  time = 500
  assert.equal(bucket.take().allowed, false)
  time = 1500
  assert.equal(bucket.take().remaining, 0.5)
  time = 2000
  assert.equal(bucket.take().allowed, true)
  for (const cost of [0, -1, 2, NaN, Infinity, 0.5])
    assert.throws(() => bucket.take(cost), RangeError)
  for (const config of [{ capacity: 0 }, { refillPerSecond: 0 }, { capacity: Infinity }])
    assert.throws(() => createTokenBucket(config), RangeError)
})

test('T06: una operación North bloqueada no añade cola; South todavía puede ejecutar', async (t) => {
  const entered = deferred(),
    gate = deferred()
  t.after(() => gate.resolve({ text: 'NORTH' }))
  let calls = 0
  const { lab, admission } = await fixture(t, {
    worker: ({ tenantId }) => {
      calls++
      if (tenantId === 'north') {
        entered.resolve()
        return gate.promise
      }
      return { text: 'SOUTH' }
    },
  })
  const first = call(lab)
  await entered.promise
  assert.equal((await call(lab)).status, 429)
  assert.equal(calls, 1)
  assert.equal((await call(lab, { tenant: 'south', token: 'demo-bob' })).status, 200)
  assert.equal(calls, 2)
  assert.equal(admission.snapshot().total, 1)
  gate.resolve({ text: 'NORTH' })
  assert.equal((await first).status, 200)
  assert.equal(admission.snapshot().total, 0)
})

test('T06: capacidad compartida llena devuelve 503 antes de iniciar trabajo South', async (t) => {
  const entered = deferred(),
    gate = deferred()
  t.after(() => gate.resolve({ text: 'OK' }))
  let calls = 0
  const { lab } = await fixture(t, {
    config: { global: 1 },
    worker: () => {
      calls++
      entered.resolve()
      return gate.promise
    },
  })
  const first = call(lab)
  await entered.promise
  const denied = await call(lab, { tenant: 'south', token: 'demo-bob' })
  assert.equal(denied.status, 503)
  assert.equal(denied.retryAfter, '1')
  assert.equal(calls, 1)
  gate.resolve({ text: 'OK' })
  await first
})

test('T06: finally libera cupo tras error, pero la solicitud admitida consume su token', async (t) => {
  let fail = true
  const { lab, admission } = await fixture(t, {
    config: { capacity: 1 },
    worker: () => {
      if (fail) throw Object.assign(new Error('Fixture error'), { status: 502 })
      return { text: 'OK' }
    },
  })
  assert.equal((await call(lab)).status, 502)
  assert.equal(admission.snapshot().total, 0)
  fail = false
  const denied = await call(lab)
  assert.equal(denied.status, 429)
  assert.equal(admission.snapshot().total, 0)
})

test('T06: cuota HTTP por tenant, Retry-After redondeado y recarga con reloj inyectado', async (t) => {
  const { lab, advance, admission } = await fixture(t)
  for (let index = 0; index < 4; index++) assert.equal((await call(lab)).status, 200)
  const denied = await call(lab)
  assert.equal(denied.status, 429)
  assert.equal(denied.retryAfter, '1')
  assert.equal(admission.snapshot().total, 0)
  advance(500)
  assert.equal((await call(lab)).status, 429)
  advance(500)
  assert.equal((await call(lab)).status, 200)
})

test('T06: IP y tenant declarados por el cliente no permiten cambiar la clave de cuota', async (t) => {
  const { lab } = await fixture(t)
  for (let index = 0; index < 4; index++)
    assert.equal(
      (
        await call(lab, {
          headers: { 'x-forwarded-for': `192.0.2.${index}`, 'x-tenant': 'south' },
        })
      ).status,
      200,
    )
  assert.equal(
    (
      await call(lab, {
        headers: { 'x-forwarded-for': '192.0.2.99', 'x-tenant': 'south' },
      })
    ).status,
    429,
  )
  assert.equal((await call(lab, { tenant: 'south', token: 'demo-bob' })).status, 200)
})

test('T06: solicitudes sin identidad o con tenant ajeno no consumen cuota ni ejecutan trabajo', async (t) => {
  let calls = 0
  const { lab } = await fixture(t, {
    worker: () => {
      calls++
      return { text: 'OK' }
    },
  })
  assert.equal((await call(lab, { token: null })).status, 401)
  assert.equal((await call(lab, { tenant: 'south' })).status, 404)
  assert.equal(calls, 0)
  for (let index = 0; index < 4; index++) assert.equal((await call(lab)).status, 200)
  assert.equal(calls, 4)
})

test('T06: solicitudes simultáneas no superan el cupo ni crean trabajo diferido', async (t) => {
  const entered = deferred(),
    gate = deferred()
  t.after(() => gate.resolve({ text: 'OK' }))
  let calls = 0
  const { lab } = await fixture(t, {
    worker: () => {
      calls++
      entered.resolve()
      return gate.promise
    },
  })
  const first = call(lab)
  await entered.promise
  const rejected = await Promise.all(Array.from({ length: 8 }, () => call(lab)))
  assert.ok(rejected.every((row) => row.status === 429))
  assert.equal(calls, 1)
  gate.resolve({ text: 'OK' })
  await first
  assert.equal(calls, 1)
  // Los rechazos por concurrencia no gastaron los otros tres tokens.
  for (let index = 0; index < 3; index++) assert.equal((await call(lab)).status, 200)
  assert.equal((await call(lab)).status, 429)
})

test('T06: cancelación cooperativa del cliente HTTP libera cupo después del deadline', async (t) => {
  const destinations = await startDestinations()
  t.after(() => destinations.close())
  const admission = createAdmission()
  const lab = await startLab({
    admission,
    importer: createImporter({ ...destinations, resolve: fixedResolver().resolve }),
  })
  t.after(() => lab.close())
  assert.equal((await call(lab, { body: { reference: 'silent' } })).status, 504)
  assert.equal(admission.snapshot().total, 0)
  assert.equal((await call(lab)).status, 200)
  assert.equal(admission.snapshot().total, 0)
})
