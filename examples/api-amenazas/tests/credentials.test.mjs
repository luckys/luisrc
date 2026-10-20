import test from 'node:test'
import assert from 'node:assert/strict'
import { request as httpRequest } from 'node:http'
import { createHash } from 'node:crypto'
import { startLab } from '../lab.mjs'
import { createCredentials, identifyClient } from '../credentials.mjs'

const principal = {
  subject: 'sync-north',
  tenantId: 'north',
  scopes: ['documents:read', 'imports:run'],
}
async function fixture(t, options = {}) {
  let time = 0
  const records = new Map()
  const credentials = createCredentials({ now: () => time, records })
  const issued = credentials.issue({ ...principal, ttlMs: 10000, ...options })
  let work = 0
  const lab = await startLab({
    identify: identifyClient(credentials),
    importer: async () => {
      work++
      return { text: 'OK' }
    },
  })
  t.after(() => lab.close())
  return {
    lab,
    credentials,
    issued,
    records,
    advance: (ms) => {
      time += ms
    },
    calls: () => work,
  }
}
async function call(lab, key, path = '/tenants/north/documents/d1', options = {}) {
  const response = await fetch(lab.origin + path, {
    ...options,
    headers: { ...(key ? { authorization: `Bearer ${key}` } : {}), ...options.headers },
  })
  return {
    status: response.status,
    challenge: response.headers.get('www-authenticate'),
    body: await response.json(),
  }
}

test('T07: registro guarda digest y metadatos, no conserva el token como valor', async (t) => {
  const { credentials, issued, records } = await fixture(t)
  assert.match(issued.token, /^lab1\.[a-f0-9]{16}\.[a-f0-9]{64}$/)
  const record = records.get(issued.id)
  assert.ok(Buffer.isBuffer(record.digest))
  assert.deepEqual(record.digest, createHash('sha256').update(issued.token).digest())
  assert.ok(!JSON.stringify([...records]).includes(issued.token))
  assert.deepEqual(credentials.verify(`Bearer ${issued.token}`), principal)
})

test('T07: token válido lee su tenant y parámetros de identidad del cliente no lo cambian', async (t) => {
  const { lab, issued } = await fixture(t)
  assert.equal((await call(lab, issued.token)).status, 200)
  assert.equal(
    (
      await call(lab, issued.token, '/tenants/south/documents/d1', {
        headers: { 'x-tenant': 'south', 'x-user': 'bob' },
      })
    ).status,
    404,
  )
})

test('T07: credenciales vacías, públicas antiguas, inventadas y alteradas responden igual sin ejecutar trabajo', async (t) => {
  const { lab, issued, calls } = await fixture(t)
  const changed = issued.token.slice(0, -1) + (issued.token.endsWith('0') ? '1' : '0')
  for (const token of [null, 'demo-alice', 'invented', changed]) {
    const result = await call(lab, token, '/tenants/north/imports', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"reference":"a1"}',
    })
    assert.equal(result.status, 401)
    assert.deepEqual(result.body, { error: 'unauthenticated' })
    assert.equal(result.challenge, 'Bearer realm="api-lab"')
  }
  assert.equal(calls(), 0)
})

test('T07: scope válido no sustituye ownership; scope ausente impide llamar al importador', async (t) => {
  const { lab, issued, calls } = await fixture(t, {
    scopes: ['documents:read', 'documents:write'],
  })
  assert.equal(
    (
      await call(lab, issued.token, '/tenants/north/imports', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{"reference":"a1"}',
      })
    ).status,
    403,
  )
  assert.equal(calls(), 0)
  assert.equal(
    (
      await call(lab, issued.token, '/tenants/north/documents/d1', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: '{"title":"No"}',
      })
    ).status,
    403,
  )
  assert.equal(lab.store.get('north', 'd1').title, "O'Reilly")
})

test('T07: credencial con scope de importación tiene un control positivo HTTP', async (t) => {
  const { lab, issued, calls } = await fixture(t)
  assert.equal(
    (
      await call(lab, issued.token, '/tenants/north/imports', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{"reference":"a1"}',
      })
    ).status,
    200,
  )
  assert.equal(calls(), 1)
})

test('T07: expiración en el borde y revocación se comprueban en cada solicitud', async (t) => {
  const { lab, credentials, issued, advance } = await fixture(t)
  advance(9999)
  assert.equal((await call(lab, issued.token)).status, 200)
  advance(1)
  assert.equal((await call(lab, issued.token)).status, 401)
  const next = credentials.issue({ ...principal, ttlMs: 10000 })
  assert.equal((await call(lab, next.token)).status, 200)
  credentials.revoke(next.id)
  assert.equal((await call(lab, next.token)).status, 401)
})

test('T07: almacén indisponible falla cerrado, sin aceptar el fixture público como fallback', async (t) => {
  const { lab, credentials, issued } = await fixture(t)
  credentials.setAvailable(false)
  const failed = await call(lab, issued.token)
  assert.equal(failed.status, 503)
  assert.ok(!JSON.stringify(failed).includes(issued.token))
  assert.equal((await call(lab, 'demo-alice')).status, 401)
  credentials.setAvailable(true)
  assert.equal((await call(lab, issued.token)).status, 200)
})

test('T07: token en query o cabecera de identidad no sustituye Authorization', async (t) => {
  const { lab, issued } = await fixture(t)
  const result = await call(
    lab,
    null,
    `/tenants/north/documents/d1?api_key=${issued.token}`,
    { headers: { 'x-user': 'sync-north' } },
  )
  assert.equal(result.status, 401)
  assert.ok(!JSON.stringify(result).includes(issued.token))
})

test('T07: duplicar Authorization se rechaza antes de interpretar una credencial', async (t) => {
  const { lab, issued } = await fixture(t)
  const result = await new Promise((resolve, reject) => {
    const request = httpRequest(
      lab.origin + '/tenants/north/documents/d1',
      {
        headers: { Authorization: [`Bearer ${issued.token}`, `Bearer ${issued.token}`] },
      },
      (response) => {
        response.resume()
        response.on('end', () => resolve(response.statusCode))
      },
    )
    request.on('error', reject)
    request.end()
  })
  assert.equal(result, 401)
})

test('T07: parser acotado no acepta prefijos, espacios finales o texto no ASCII como token', async (t) => {
  const { credentials, issued } = await fixture(t)
  for (const value of [
    '',
    `Bearer ${issued.token} `,
    `Bearer ${issued.token}\n`,
    `Bearer ${issued.token}\r\n`,
    `Bearer ${issued.token}more`,
    'Bearer ' + 'ñ'.repeat(90),
    'Bearer ' + 'a'.repeat(1000),
    `Basic ${issued.token}`,
  ])
    assert.equal(credentials.verify(value), undefined)
  assert.deepEqual(credentials.verify(`bearer ${issued.token}`), principal)
})

test('T07: rotación conserva metadatos y convivir no equivale a revocar', async (t) => {
  const { lab, credentials, issued } = await fixture(t)
  const next = credentials.issue({ ...principal, ttlMs: 10000 })
  assert.notEqual(next.id, issued.id)
  assert.equal((await call(lab, issued.token)).status, 200)
  assert.equal((await call(lab, next.token)).status, 200)
  credentials.revoke(issued.id)
  assert.equal((await call(lab, issued.token)).status, 401)
  assert.equal((await call(lab, next.token)).status, 200)
})
