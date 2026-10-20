import test from 'node:test'
import assert from 'node:assert/strict'
import { startLab } from '../lab.mjs'
import { parseTitleChange, simulateAssignment } from '../command.mjs'

async function fixture(t) {
  const lab = await startLab()
  t.after(() => lab.close())
  return lab
}

async function request(lab, path, { token = 'demo-alice', body, method = 'GET' } = {}) {
  const response = await fetch(lab.origin + path, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
  return { status: response.status, body: await response.json() }
}

test('T01: ni ausencia, ni token inventado, ni un sufijo del fixture crean identidad', async (t) => {
  const lab = await fixture(t)
  for (const token of [null, 'inventado', 'demo-alice-extra']) {
    const result = await request(lab, '/tenants/north/documents', { token })
    assert.equal(result.status, 401)
    assert.deepEqual(result.body, { error: 'unauthenticated' })
  }
  assert.equal((await request(lab, '/tenants/north/documents')).status, 200)
})

test('T02: mismo ID en dos tenants, lectura y modificación ajenas sin efectos', async (t) => {
  const lab = await fixture(t)
  for (const mode of ['safe', 'unsafe']) {
    const denied = await request(lab, `/tenants/south/documents/d1?mode=${mode}`, {
      method: 'PATCH',
      body: { title: 'Invadido' },
    })
    assert.equal(denied.status, 404)
  }
  assert.equal((await request(lab, '/tenants/south/documents')).status, 404)
  const south = await request(lab, '/tenants/south/documents/d1', { token: 'demo-bob' })
  assert.equal(south.body.title, 'Privado South')
  const north = await request(lab, '/tenants/north/documents/d1')
  assert.equal(north.body.title, "O'Reilly")
})

test('T02: ser miembro del tenant no concede editar el documento de otra persona', async (t) => {
  const lab = await fixture(t)
  const result = await request(lab, '/tenants/north/documents/d2', {
    method: 'PATCH',
    body: { title: 'Invadido' },
  })
  assert.equal(result.status, 403)
  assert.equal(
    (await request(lab, '/tenants/north/documents/d2')).body.title,
    'Guía de Bob',
  )
})

test('T03: variante vulnerable publica y cambia propietario pese al permiso inicial correcto', async (t) => {
  const lab = await fixture(t)
  const result = await request(lab, '/tenants/north/documents/d1?mode=unsafe', {
    method: 'PATCH',
    body: { title: 'Editado', ownerId: 'bob', state: 'published' },
  })
  assert.equal(result.status, 200)
  const row = lab.store.get('north', 'd1')
  assert.equal(row.ownerId, 'bob')
  assert.equal(row.state, 'published')
  assert.equal(row.title, 'Editado')
})

test('T03: allowlist rechaza propiedades protegidas, desconocidas, anidadas y __proto__ sin cambios', async (t) => {
  const lab = await fixture(t)
  const before = lab.store.get('north', 'd1')
  const extras = [
    { ownerId: 'bob' },
    { state: 'published' },
    { tenantId: 'south' },
    { internalNote: 'visible' },
    { futurePrivilege: true },
    { profile: { role: 'admin' } },
    JSON.parse('{"__proto__":{"admin":true}}'),
  ]
  for (const extra of extras) {
    const result = await request(lab, '/tenants/north/documents/d1', {
      method: 'PATCH',
      body: { title: 'No guardar', ...extra },
    })
    assert.equal(result.status, 422)
    assert.deepEqual(lab.store.get('north', 'd1'), before)
  }
  assert.equal({}.admin, undefined)
})

test('T03: cambio permitido conserva metadatos y devuelve solo el DTO público', async (t) => {
  const lab = await fixture(t)
  const before = lab.store.get('north', 'd1')
  const result = await request(lab, '/tenants/north/documents/d1', {
    method: 'PATCH',
    body: { title: '  Nuevo título  ' },
  })
  assert.deepEqual(result, { status: 200, body: { id: 'd1', title: 'Nuevo título' } })
  assert.deepEqual(lab.store.get('north', 'd1'), { ...before, title: 'Nuevo título' })
})

test('T03: la función pura exige un objeto y un título, sin coerción', () => {
  for (const body of [
    null,
    [],
    {},
    'texto',
    2,
    { title: 42 },
    { title: '' },
    { title: ' '.repeat(5) },
    { title: 'a'.repeat(121) },
  ]) {
    assert.throws(() => parseTitleChange(body), { status: 422 })
  }
  assert.deepEqual(parseTitleChange({ title: " O'Reilly " }), { title: "O'Reilly" })
  assert.equal(simulateAssignment('safe', { title: 'x', state: 'published' }).status, 422)
  assert.equal(
    simulateAssignment('unsafe', { title: 'x', state: 'published' }).after.state,
    'published',
  )
})

test('T03: UPDATE seguro vuelve a exigir owner y draft y solo escribe el título', async (t) => {
  const lab = await fixture(t)
  const original = lab.store.get('north', 'd1')
  assert.equal(lab.store.changeTitle('north', 'd1', 'bob', 'No'), false)
  lab.store.save(original, { ...original, state: 'published' })
  assert.equal(lab.store.changeTitle('north', 'd1', 'alice', 'No'), false)
  assert.equal(lab.store.get('north', 'd1').title, "O'Reilly")
})

test('T04: concatenación filtra tres filas de dos tenants; parámetros tratan la sonda literalmente', async (t) => {
  const lab = await fixture(t)
  const query = encodeURIComponent("' OR 1=1 --")
  const unsafe = await request(lab, `/tenants/north/search?mode=unsafe&title=${query}`)
  assert.deepEqual(
    unsafe.body.map((row) => row.title).sort(),
    ['Guía de Bob', "O'Reilly", 'Privado South'].sort(),
  )
  const safe = await request(lab, `/tenants/north/search?title=${query}`)
  assert.deepEqual(safe.body, [])
  const valid = await request(
    lab,
    `/tenants/north/search?title=${encodeURIComponent("O'Reilly")}`,
  )
  assert.deepEqual(valid.body, [{ id: 'd1', title: "O'Reilly" }])
})

test('T04: parámetros preservan un título que parece SQL y no reemplazan el filtro de tenant', async (t) => {
  const lab = await fixture(t)
  const title = "' OR 1=1 --"
  await request(lab, '/tenants/north/documents/d1', { method: 'PATCH', body: { title } })
  const result = await request(
    lab,
    `/tenants/north/search?title=${encodeURIComponent(title)}`,
  )
  assert.deepEqual(result.body, [{ id: 'd1', title }])
  assert.deepEqual(
    (await request(lab, `/tenants/north/search?title=Privado%20South`)).body,
    [],
  )
  // Consulta parametrizada intencionadamente incompleta: sin tenant aún filtra South.
  assert.equal(lab.store.searchWithoutTenant('Privado South')[0].title, 'Privado South')
})

test('T04: ordenar selecciona SQL fijo y rechaza sintaxis arbitraria', async (t) => {
  const lab = await fixture(t)
  for (const sort of ['title', 'id'])
    assert.equal(
      (
        await request(
          lab,
          `/tenants/north/search?title=${encodeURIComponent("O'Reilly")}&sort=${sort}`,
        )
      ).status,
      200,
    )
  for (const sort of ['title; DROP TABLE documents; --', '__proto__', 'toString']) {
    const result = await request(
      lab,
      `/tenants/north/search?sort=${encodeURIComponent(sort)}`,
    )
    assert.equal(result.status, 422)
  }
  assert.equal((await request(lab, '/tenants/north/documents')).body.length, 2)
})

test('entrada HTTP: JSON inválido, media type y límite de bytes no se convierten en 500', async (t) => {
  const lab = await fixture(t)
  for (const [body, media, status] of [
    ['{', 'application/json', 400],
    ['{}', 'text/plain', 415],
    [JSON.stringify({ title: 'ñ'.repeat(3000) }), 'application/json', 413],
  ]) {
    const result = await fetch(lab.origin + '/tenants/north/documents/d1', {
      method: 'PATCH',
      headers: { authorization: 'Bearer demo-alice', 'content-type': media },
      body,
    })
    assert.equal(result.status, status)
    assert.ok(!(await result.text()).includes('SQLite'))
  }
  assert.equal(lab.store.get('north', 'd1').title, "O'Reilly")
})

test('método desconocido no modifica y modo inexistente no activa la variante insegura', async (t) => {
  const lab = await fixture(t)
  const result = await request(lab, '/tenants/north/documents/d1', {
    method: 'POST',
    body: { title: 'x' },
  })
  assert.equal(result.status, 405)
  const raw = await fetch(lab.origin + '/tenants/north/documents/d1', {
    method: 'POST',
    headers: { authorization: 'Bearer demo-alice' },
  })
  assert.equal(raw.headers.get('allow'), 'GET, PATCH')
  await raw.text()
  assert.equal((await request(lab, '/tenants/north/search?mode=typo')).status, 422)
  assert.equal(lab.store.get('north', 'd1').title, "O'Reilly")
})
