import test from 'node:test'
import assert from 'node:assert/strict'
import { startLab } from '../lab.mjs'

async function setup(t) {
  const lab = await startLab()
  t.after(() => lab.close())
  const session = await fetch(`${lab.app}/session`)
  const cookie = session.headers.get('set-cookie').split(';')[0]
  const token = (
    await (await fetch(`${lab.app}/api/token`, { headers: { cookie } })).json()
  ).csrf
  return { ...lab, cookie, token }
}

test('HTTP: sesión de fixture opaca, HttpOnly y SameSite explícito; sin ella no hay datos', async (t) => {
  const lab = await startLab()
  t.after(() => lab.close())
  assert.equal((await fetch(`${lab.app}/api/state`)).status, 401)
  const result = await fetch(`${lab.app}/session`)
  assert.match(
    result.headers.get('set-cookie'),
    /^lab_session=[a-f0-9]{48}; Path=\/; HttpOnly; SameSite=Lax$/,
  )
  assert.equal(result.headers.get('cache-control'), 'no-store')
})

test('HTTP: mutación protegida exige sesión, origen exacto y token ligado a ella', async (t) => {
  const lab = await setup(t)
  const mutate = (headers, csrf) =>
    fetch(`${lab.app}/api/title/safe`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', ...headers },
      body: new URLSearchParams({ title: 'Cambio', csrf }),
    })
  assert.equal((await mutate({ origin: lab.app }, lab.token)).status, 401)
  for (const origin of [undefined, 'null', lab.attacker, `${lab.app}.evil.test`]) {
    const headers = { cookie: lab.cookie, ...(origin ? { origin } : {}) }
    assert.equal((await mutate(headers, lab.token)).status, 403)
  }
  assert.equal(
    (await mutate({ cookie: lab.cookie, origin: lab.app }, 'inventado')).status,
    403,
  )
  assert.equal(
    (await mutate({ cookie: lab.cookie, origin: lab.app }, 'é'.repeat(48))).status,
    403,
  )
  assert.equal(
    (await mutate({ cookie: lab.cookie, origin: lab.app }, lab.token)).status,
    200,
  )
  assert.equal(
    (
      await (
        await fetch(`${lab.app}/api/state`, { headers: { cookie: lab.cookie } })
      ).json()
    ).title,
    'Cambio',
  )
})

test('HTTP: otro token de sesión no sirve y una denegación conserva el estado', async (t) => {
  const lab = await setup(t)
  const other = await fetch(`${lab.app}/session`)
  const cookie = other.headers.get('set-cookie').split(';')[0]
  const response = await fetch(`${lab.app}/api/title/safe`, {
    method: 'POST',
    headers: {
      cookie,
      origin: lab.app,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ title: 'Ajeno', csrf: lab.token }),
  })
  assert.equal(response.status, 403)
  assert.equal(
    (await (await fetch(`${lab.app}/api/state`, { headers: { cookie } })).json()).title,
    'Original',
  )
})

test('HTTP: CORS cerrado no impide al cliente no navegador autenticado leer', async (t) => {
  const lab = await setup(t)
  const result = await fetch(`${lab.app}/api/cors/closed`, {
    headers: { cookie: lab.cookie, origin: lab.attacker },
  })
  assert.equal(result.status, 200)
  assert.equal(result.headers.get('access-control-allow-origin'), null)
  assert.equal((await result.json()).title, 'Original')
  assert.equal(
    (await fetch(`${lab.app}/api/cors/allow`, { headers: { origin: lab.trusted } }))
      .status,
    401,
  )
})

test('HTTP: preflight comprueba origen, método y headers sin exigir cookie', async (t) => {
  const lab = await setup(t)
  const preflight = (origin, method, headers) =>
    fetch(`${lab.app}/api/preflight/allow`, {
      method: 'OPTIONS',
      headers: {
        origin,
        'access-control-request-method': method,
        'access-control-request-headers': headers,
      },
    })
  const ok = await preflight(lab.trusted, 'PATCH', 'content-type,x-lab')
  assert.equal(ok.status, 204)
  assert.equal(ok.headers.get('access-control-allow-origin'), lab.trusted)
  assert.equal(ok.headers.get('access-control-allow-credentials'), 'true')
  assert.match(ok.headers.get('vary'), /Origin/)
  assert.equal((await preflight(lab.attacker, 'PATCH', 'content-type,x-lab')).status, 403)
  assert.equal((await preflight(lab.trusted, 'DELETE', 'x-lab')).status, 403)
  assert.equal((await preflight(lab.trusted, 'PATCH', 'authorization')).status, 403)
})

test('HTTP: CSP cambia por respuesta; Report-Only no se presenta como enforce', async (t) => {
  const lab = await setup(t)
  const a = await fetch(`${lab.app}/xss?mode=enforce`)
  const b = await fetch(`${lab.app}/xss?mode=enforce`)
  const policy = a.headers.get('content-security-policy')
  assert.match(policy, /script-src 'nonce-[A-Za-z0-9+/=]+'/)
  assert.match(policy, /base-uri 'none'; form-action 'self'; frame-ancestors 'none'/)
  assert.notEqual(policy, b.headers.get('content-security-policy'))
  const report = await fetch(`${lab.app}/xss?mode=report`)
  assert.equal(report.headers.get('content-security-policy'), null)
  assert.ok(report.headers.get('content-security-policy-report-only'))
})

test('HTTP: GET no muta y entradas inválidas no cambian el título', async (t) => {
  const lab = await setup(t)
  assert.equal(
    (await fetch(`${lab.app}/api/title/safe`, { headers: { cookie: lab.cookie } }))
      .status,
    405,
  )
  for (const [type, body, status] of [
    ['application/json', '{}', 415],
    ['application/x-www-form-urlencoded', 'title=', 400],
    ['application/x-www-form-urlencoded', `title=${'x'.repeat(5000)}`, 413],
  ]) {
    const result = await fetch(`${lab.app}/api/title/safe`, {
      method: 'POST',
      headers: { cookie: lab.cookie, origin: lab.app, 'content-type': type },
      body,
    })
    assert.equal(result.status, status)
  }
  assert.equal(
    (
      await (
        await fetch(`${lab.app}/api/state`, { headers: { cookie: lab.cookie } })
      ).json()
    ).title,
    'Original',
  )
})
