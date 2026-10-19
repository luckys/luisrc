import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { createApp } from '../server.mjs'
import { createFixtures } from '../fixtures.mjs'

async function setup(t) {
  const store = createFixtures()
  const server = createServer(createApp(store))
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(
    () =>
      new Promise((resolve) => {
        server.close(resolve)
        server.closeAllConnections()
      }),
  )
  const origin = `http://127.0.0.1:${server.address().port}`
  const request = async (actor, path, { method = 'GET', body, headers = {} } = {}) => {
    const response = await fetch(origin + path, {
      method,
      headers: {
        ...(actor ? { Authorization: `Bearer ${actor}-demo` } : {}),
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    })
    return {
      status: response.status,
      headers: response.headers,
      body: await response.json(),
    }
  }
  return { request, store, origin }
}

test('HTTP: credencial ausente/desconocida no se convierte en identidad mediante headers', async (t) => {
  const { request } = await setup(t)
  for (const actor of [null, 'unknown']) {
    const result = await request(actor, '/tenants/north/documents/shared', {
      headers: { 'X-User-Id': 'user-alice', 'X-Role': 'admin' },
    })
    assert.equal(result.status, 401)
    assert.equal(result.headers.get('www-authenticate'), 'Bearer realm="permissions-lab"')
  }
})

test('HTTP: controles positivos y proyección de salida', async (t) => {
  const { request } = await setup(t)
  const read = await request('alice', '/tenants/north/documents/shared')
  assert.equal(read.status, 200)
  assert.deepEqual(Object.keys(read.body).sort(), ['id', 'ownerId', 'state', 'title'])
  const write = await request('alice', '/tenants/north/documents/shared', {
    method: 'PATCH',
    body: { title: 'Título revisado' },
  })
  assert.equal(write.status, 200)
  assert.equal(write.body.title, 'Título revisado')
  assert.equal(
    (await request('alice', '/tenants/north/documents/shared')).body.title,
    'Título revisado',
  )
})

test('HTTP: cambiar ID no permite leer o modificar el draft de otra persona', async (t) => {
  const { request } = await setup(t)
  for (const method of ['GET', 'PATCH']) {
    const denied = await request('alice', '/tenants/north/documents/bob-draft', {
      method,
      ...(method === 'PATCH' ? { body: { title: 'Intrusión' } } : {}),
    })
    assert.equal(denied.status, 404)
    assert.deepEqual(denied.body, { error: 'not_found' })
  }
  const owner = await request('bob', '/tenants/north/documents/bob-draft')
  assert.equal(owner.status, 200)
  assert.equal(owner.body.title, 'Draft de Bob')
})

test('HTTP: la pertenencia al tenant y el rol se consultan en servidor, no en headers/query', async (t) => {
  const { request } = await setup(t)
  const denied = await request(
    'rita',
    '/tenants/south/documents/south-private?tenantId=north&role=admin',
    {
      headers: { 'X-Tenant-Id': 'north', 'X-Role': 'admin' },
    },
  )
  assert.equal(denied.status, 404)
  const memberWithoutWrite = await request(
    'alice',
    '/tenants/south/documents/south-published',
    {
      method: 'PATCH',
      body: { title: 'Intrusión' },
      headers: { 'X-Role': 'admin' },
    },
  )
  assert.equal(memberWithoutWrite.status, 403)
})

test('HTTP: un ID conocido solo en south no se encuentra bajo north, ni para admin', async (t) => {
  const { request } = await setup(t)
  for (const method of ['GET', 'PATCH']) {
    const result = await request('trent', '/tenants/north/documents/south-private', {
      method,
      ...(method === 'PATCH' ? { body: { title: 'Intrusión' } } : {}),
    })
    assert.equal(result.status, 404)
  }
  const owner = await request('bob', '/tenants/south/documents/south-private')
  assert.equal(owner.status, 200)
  assert.equal(owner.body.title, 'Privado de South')
})

test('HTTP: IDs repetidos en tenants distintos no colisionan ni mezclan roles', async (t) => {
  const { request } = await setup(t)
  assert.equal(
    (await request('alice', '/tenants/north/documents/shared')).body.title,
    'Draft de North',
  )
  assert.equal((await request('alice', '/tenants/south/documents/shared')).status, 404)
  assert.equal(
    (await request('bob', '/tenants/south/documents/shared')).body.title,
    'Draft de South',
  )
  assert.equal((await request('trent', '/tenants/south/documents/shared')).status, 404)
})

test('HTTP: lista y total aplican autorización antes del límite', async (t) => {
  const { request } = await setup(t)
  const first = await request('rita', '/tenants/north/documents?limit=1')
  assert.equal(first.status, 200)
  assert.equal(first.body.total, 1)
  assert.deepEqual(
    first.body.items.map((row) => row.id),
    ['published'],
  )
  const owner = await request('alice', '/tenants/north/documents?limit=20')
  assert.equal(owner.body.total, 3)
  assert.ok(!owner.body.items.some((row) => row.id === 'bob-draft'))
  assert.equal((await request('rita', '/tenants/south/documents')).status, 404)
  assert.equal((await request('alice', '/tenants/north/documents?limit=21')).status, 400)
})

test('HTTP: no se puede modificar owner, tenant, estado o rol mediante el body', async (t) => {
  const { request } = await setup(t)
  for (const field of ['ownerId', 'tenantId', 'state', 'role', '__proto__']) {
    const result = await request('alice', '/tenants/north/documents/shared', {
      method: 'PATCH',
      body: JSON.parse(`{"title":"Intrusión","${field}":"admin"}`),
    })
    assert.equal(result.status, 400, field)
  }
  assert.equal(
    (await request('alice', '/tenants/north/documents/shared')).body.title,
    'Draft de North',
  )
})

test('HTTP: revocar membership o rebajar rol afecta a la siguiente petición con el mismo token', async (t) => {
  const { request, store } = await setup(t)
  const path = '/tenants/north/documents/shared'
  assert.equal((await request('alice', path)).status, 200)
  store.setMembership('user-alice', 'north', 'reader')
  assert.equal(
    (await request('alice', path, { method: 'PATCH', body: { title: 'No' } })).status,
    403,
  )
  store.setMembership('user-alice', 'north', null)
  assert.equal((await request('alice', path)).status, 404)
})

test('HTTP: admin es local al tenant, no puede editar estados inmutables', async (t) => {
  const { request } = await setup(t)
  const yes = await request('trent', '/tenants/north/documents/bob-draft', {
    method: 'PATCH',
    body: { title: 'Revisión de admin' },
  })
  assert.equal(yes.status, 200)
  for (const id of ['published', 'archived']) {
    const before = await request('trent', `/tenants/north/documents/${id}`)
    assert.equal(
      (
        await request('trent', `/tenants/north/documents/${id}`, {
          method: 'PATCH',
          body: { title: 'No' },
        })
      ).status,
      403,
    )
    assert.equal(
      (await request('trent', `/tenants/north/documents/${id}`)).body.title,
      before.body.title,
    )
  }
})

test('HTTP: verbo desconocido no hereda permisos de lectura ni altera el recurso', async (t) => {
  const { request } = await setup(t)
  const result = await request('alice', '/tenants/north/documents/shared', {
    method: 'DELETE',
  })
  assert.equal(result.status, 405)
  assert.equal(result.headers.get('allow'), 'GET, PATCH')
  assert.equal((await request('alice', '/tenants/north/documents/shared')).status, 200)
})

test('HTTP: sin membership, objeto inexistente y objeto invisible comparten error público', async (t) => {
  const { request } = await setup(t)
  const missing = await request('alice', '/tenants/north/documents/missing')
  const invisible = await request('alice', '/tenants/north/documents/bob-draft')
  const otherTenant = await request('rita', '/tenants/south/documents/south-private')
  const noMembership = await request('mallory', '/tenants/north/documents/published')
  for (const result of [missing, invisible, otherTenant, noMembership]) {
    assert.equal(result.status, 404)
    assert.deepEqual(result.body, { error: 'not_found' })
    assert.equal(result.headers.get('cache-control'), 'no-store')
  }
})

test('HTTP: entrada inválida, media type y límite de bytes no provocan escritura', async (t) => {
  const { request, origin } = await setup(t)
  for (const body of [
    null,
    [],
    {},
    { title: 4 },
    { title: '   ' },
    { title: 'x'.repeat(121) },
  ])
    assert.equal(
      (
        await request('alice', '/tenants/north/documents/shared', {
          method: 'PATCH',
          body,
        })
      ).status,
      400,
    )
  for (const [body, contentType, status] of [
    ['{', 'application/json', 400],
    ['{"title":"ok"}', 'text/plain', 415],
    ['x'.repeat(5000), 'application/json', 413],
  ]) {
    const response = await fetch(`${origin}/tenants/north/documents/shared`, {
      method: 'PATCH',
      headers: { Authorization: 'Bearer alice-demo', 'Content-Type': contentType },
      body,
    })
    assert.equal(response.status, status)
    await response.arrayBuffer()
  }
  assert.equal(
    (await request('alice', '/tenants/north/documents/shared')).body.title,
    'Draft de North',
  )
})
