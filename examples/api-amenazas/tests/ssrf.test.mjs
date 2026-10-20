import test from 'node:test'
import assert from 'node:assert/strict'
import { startLab } from '../lab.mjs'
import { startDestinations, fixedResolver, changingResolver } from '../destinations.mjs'
import { createImporter, parseProviderUrl } from '../importer.mjs'

async function fixture(t, resolver = fixedResolver()) {
  const destinations = await startDestinations()
  t.after(() => destinations.close())
  const importer = createImporter({ ...destinations, resolve: resolver.resolve })
  const lab = await startLab({ importer })
  t.after(() => lab.close())
  return { lab, destinations, resolver }
}
async function call(
  lab,
  {
    tenant = 'north',
    token = 'demo-alice',
    mode = 'safe',
    input = { reference: 'a1' },
  } = {},
) {
  const response = await fetch(`${lab.origin}/tenants/${tenant}/imports?mode=${mode}`, {
    method: 'POST',
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      'content-type': 'application/json',
    },
    body: JSON.stringify(input),
  })
  return { status: response.status, body: await response.json() }
}

test('T05: URL vulnerable consulta el marcador interno solo dentro del sandbox', async (t) => {
  const { lab, destinations: d } = await fixture(t)
  const result = await call(lab, {
    mode: 'unsafe-url',
    input: { url: d.internalOrigin + '/marker' },
  })
  assert.equal(result.status, 200)
  assert.equal(result.body.text, 'INTERNAL-MARKER')
  assert.equal(d.metrics.internal.length, 1)
  assert.equal(d.metrics.internal[0].localAddress, '127.0.0.2')
})

test('T05: contrato por referencia no acepta URL ni referencia ajena y no conecta', async (t) => {
  const { lab, destinations: d } = await fixture(t)
  for (const input of [
    { url: d.internalOrigin + '/marker' },
    { reference: 'a1', url: d.internalOrigin },
    { reference: '../marker' },
    { reference: 'b1' },
  ]) {
    assert.ok([403, 422].includes((await call(lab, { input })).status))
  }
  assert.equal(d.metrics.provider.length, 0)
  assert.equal(d.metrics.internal.length, 0)
})

test('T05: cada tenant importa su referencia y no reenvía credenciales del usuario', async (t) => {
  const { lab, destinations: d } = await fixture(t)
  assert.deepEqual(await call(lab), { status: 200, body: { text: 'NORTH-A1' } })
  assert.deepEqual(
    await call(lab, { token: 'demo-bob', tenant: 'south', input: { reference: 'b1' } }),
    { status: 200, body: { text: 'SOUTH-B1' } },
  )
  assert.equal(d.metrics.internal.length, 0)
  assert.equal(d.metrics.provider.length, 2)
  for (const record of d.metrics.provider) {
    assert.equal(record.host, new URL(d.providerOrigin).host)
    assert.equal(record.hasAuthorization, false)
    assert.equal(record.hasCookie, false)
    assert.equal(record.remoteAddress, '127.0.0.1')
  }
})

test('T05: sin identidad o con tenant ajeno no hay llamadas salientes ni cambios en documentos', async (t) => {
  const { lab, destinations: d } = await fixture(t)
  const before = lab.store.get('south', 'd1')
  assert.equal((await call(lab, { token: null })).status, 401)
  assert.equal(
    (await call(lab, { tenant: 'south', input: { reference: 'b1' } })).status,
    404,
  )
  assert.equal(d.metrics.provider.length + d.metrics.internal.length, 0)
  assert.deepEqual(lab.store.get('south', 'd1'), before)
})

test('T05: comprobar solo el origen inicial permite seguir un redirect al interno', async (t) => {
  const { lab, destinations: d } = await fixture(t)
  const result = await call(lab, {
    mode: 'allowlist-only',
    input: { url: d.providerOrigin + '/redirect' },
  })
  assert.equal(result.body.text, 'INTERNAL-MARKER')
  assert.equal(d.metrics.provider.length, 1)
  assert.equal(d.metrics.internal.length, 1)
})

test('T05: cliente seguro rechaza redirect y el segundo servicio no recibe la petición', async (t) => {
  const { lab, destinations: d } = await fixture(t)
  assert.equal((await call(lab, { input: { reference: 'redirect' } })).status, 502)
  assert.equal(d.metrics.provider.length, 1)
  assert.equal(d.metrics.internal.length, 0)
})

test('T05: parser exige origin exacto y rechaza credenciales, fragmento y esquemas ajenos', async (t) => {
  const { destinations: d } = await fixture(t)
  for (const value of [
    'not a url',
    `blob:${d.providerOrigin}/asset/north/a1`,
    'file:///etc/hosts',
    'https://media.fixture.test/asset/north/a1',
    d.providerOrigin.replace('media.fixture.test', 'media.fixture.test.evil.test'),
    d.providerOrigin.replace('media.fixture.test', 'user:pass@media.fixture.test') +
      '/asset/north/a1',
    d.providerOrigin + '/asset/north/a1#fragment',
    d.internalOrigin + '/marker',
  ])
    assert.throws(() => parseProviderUrl(value, d.providerOrigin), { status: 403 })
  assert.equal(
    parseProviderUrl(d.providerOrigin + '/asset/north/a1', d.providerOrigin).origin,
    d.providerOrigin,
  )
})

test('T05: harness bloquea cualquier URL fuera de sus fixtures aunque el modo sea vulnerable', async (t) => {
  const { lab, destinations: d, resolver } = await fixture(t)
  for (const url of [
    'http://outside.invalid/marker',
    `blob:${d.internalOrigin}/marker`,
    'http://127.0.0.1:1/marker',
    'https://127.0.0.2/marker',
  ])
    assert.equal((await call(lab, { mode: 'unsafe-url', input: { url } })).status, 403)
  assert.equal(resolver.calls, 0)
  assert.equal(d.metrics.provider.length + d.metrics.internal.length, 0)
})

test('T05: segunda resolución no validada conecta de verdad con el fixture no autorizado', async (t) => {
  const resolver = changingResolver()
  const { lab, destinations: d } = await fixture(t, resolver)
  const result = await call(lab, { mode: 'check-then-resolve' })
  assert.equal(result.status, 200)
  assert.equal(result.body.text, 'INTERNAL-MARKER')
  assert.equal(resolver.calls, 2)
  assert.equal(d.metrics.provider.length, 0)
  assert.equal(d.metrics.internal.length, 1)
})

test('T05: pin conecta solo a la IP aprobada y preserva Host sin resolver otra vez', async (t) => {
  const resolver = changingResolver()
  const { lab, destinations: d } = await fixture(t, resolver)
  const result = await call(lab)
  assert.equal(result.body.text, 'NORTH-A1')
  assert.equal(resolver.calls, 1)
  assert.equal(d.metrics.provider.length, 1)
  assert.equal(d.metrics.internal.length, 0)
  assert.equal(d.metrics.provider[0].host, new URL(d.providerOrigin).host)
})

test('T05: resolución vacía, rechazada o mixta falla antes del socket', async (t) => {
  for (const records of [
    [],
    [{ address: '127.0.0.2', family: 4 }],
    [
      { address: '127.0.0.1', family: 4 },
      { address: '::1', family: 6 },
    ],
  ]) {
    const resolver = { resolve: async () => records }
    const { lab, destinations: d } = await fixture(t, resolver)
    assert.equal((await call(lab)).status, 403)
    assert.equal(d.metrics.provider.length + d.metrics.internal.length, 0)
  }
})

test('T05: tamaño y deadline del cliente cierran respuestas sin límite antes de publicarlas', async (t) => {
  const { lab, destinations: d } = await fixture(t)
  assert.equal((await call(lab, { input: { reference: 'large' } })).status, 502)
  assert.equal((await call(lab, { input: { reference: 'silent' } })).status, 504)
  assert.equal(d.metrics.internal.length, 0)
})

test('T05: deadline incluye resolver inicial y una resolución tardía no abre un socket', async (t) => {
  let release
  const resolver = {
    resolve: () =>
      new Promise((resolve) => {
        release = resolve
      }),
  }
  const { lab, destinations: d } = await fixture(t, resolver)
  const result = await call(lab)
  assert.equal(result.status, 504)
  release([{ address: '127.0.0.1', family: 4 }])
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(d.metrics.provider.length + d.metrics.internal.length, 0)
})
