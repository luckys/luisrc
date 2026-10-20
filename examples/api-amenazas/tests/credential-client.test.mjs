import test from 'node:test'
import assert from 'node:assert/strict'
import { startLab } from '../lab.mjs'
import { createCredentials, identifyClient } from '../credentials.mjs'
import { createCredentialClient } from '../credential-client.mjs'
const metadata = {
  subject: 'sync-north',
  tenantId: 'north',
  scopes: ['documents:read'],
  ttlMs: 10000,
}

async function fixture(t, audit) {
  let time = 0
  const events = []
  const credentials = createCredentials({ now: () => time })
  const old = credentials.issue(metadata)
  const lab = await startLab({ identify: identifyClient(credentials) })
  t.after(() => lab.close())
  let value = { version: 'v1', token: old.token }
  const client = createCredentialClient({
    origin: lab.origin,
    tenantId: 'north',
    readSecret: async () => {
      if (value instanceof Error) throw value
      return value
    },
    audit: audit ?? ((event) => events.push(event)),
  })
  return {
    lab,
    credentials,
    old,
    client,
    events,
    set: (next) => {
      value = next
    },
    expire: () => {
      time = 10000
    },
  }
}

test('T07: sin secreto inicial no hay credencial por defecto ni llamada autenticada', async (t) => {
  const { client, set } = await fixture(t)
  set(undefined)
  await assert.rejects(client.reload(), { message: 'credential_reload_failed' })
  await assert.rejects(client.getDocument(), { message: 'credential_not_loaded' })
})

test('T07: recarga comprueba la nueva clave antes de cambiar; revocar la anterior no rompe la nueva', async (t) => {
  const { client, credentials, old, set, events } = await fixture(t)
  await client.reload()
  assert.equal((await client.getDocument()).status, 200)
  const next = credentials.issue(metadata)
  set({ version: 'v2', token: next.token })
  await client.reload()
  credentials.revoke(old.id)
  assert.equal((await client.getDocument()).status, 200)
  assert.deepEqual(events, [
    { event: 'secret_loaded', version: 'v1' },
    { event: 'secret_loaded', version: 'v2' },
  ])
  const serialized = JSON.stringify(events)
  for (const value of [old.token, next.token]) assert.ok(!serialized.includes(value))
})

test('T07: nueva clave inválida no sustituye la anterior; fallo de source no registra su error', async (t) => {
  const { client, old, set, events } = await fixture(t)
  await client.reload()
  const bad = old.token.slice(0, -1) + (old.token.endsWith('0') ? '1' : '0')
  set({ version: 'v2', token: bad })
  await assert.rejects(client.reload(), { message: 'credential_reload_failed' })
  assert.equal((await client.getDocument()).status, 200)
  set(new Error('Source error: ' + old.token))
  await assert.rejects(client.reload(), { message: 'credential_reload_failed' })
  assert.equal((await client.getDocument()).status, 200)
  assert.ok(!JSON.stringify(events).includes(old.token))
  assert.ok(!JSON.stringify(events).includes(bad))
})

test('T07: metadatos de versión no pueden transportar una credencial al audit', async (t) => {
  const { client, old, set, events } = await fixture(t)
  set({ version: old.token, token: old.token })
  await assert.rejects(client.reload(), { message: 'credential_reload_failed' })
  assert.deepEqual(events, [{ event: 'secret_reload_failed' }])
})

test('T07: revocación y caducidad no se sortean por conservar una copia local', async (t) => {
  const { client, credentials, old, set, expire } = await fixture(t)
  await client.reload()
  credentials.revoke(old.id)
  assert.equal((await client.getDocument()).status, 401)
  const next = credentials.issue(metadata)
  set({ version: 'v2', token: next.token })
  await client.reload()
  expire()
  assert.equal((await client.getDocument()).status, 401)
})

test('T07: auditoría que falla no cambia identidad ni expone secretos; URL ajena se rechaza', async (t) => {
  const { client } = await fixture(t, () => {
    throw new Error('audit failed')
  })
  await client.reload()
  assert.equal((await client.getDocument()).status, 200)
  assert.throws(
    () =>
      createCredentialClient({
        origin: 'https://outside.invalid',
        tenantId: 'north',
        readSecret: async () => ({}),
      }),
    RangeError,
  )
})

test('T07: recargas simultáneas comparten lectura y prueba de la candidata', async (t) => {
  const { lab, old } = await fixture(t)
  let release
  let reads = 0
  const source = new Promise((resolve) => {
    release = resolve
  })
  const client = createCredentialClient({
    origin: lab.origin,
    tenantId: 'north',
    readSecret: () => {
      reads++
      return source
    },
  })
  const first = client.reload()
  const second = client.reload()
  assert.equal(first, second)
  assert.equal(reads, 1)
  release({ version: 'v1', token: old.token })
  await Promise.all([first, second])
  assert.equal((await client.getDocument()).status, 200)
})
