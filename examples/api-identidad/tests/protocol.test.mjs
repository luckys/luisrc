import test from 'node:test'
import assert from 'node:assert/strict'
import { generateKeyPair, exportJWK, SignJWT } from 'jose'
import * as oidc from 'openid-client'
import { startLab } from '../lab.mjs'
import { verifyIdentityToken } from '../identity.mjs'
import { BrowserDriver, authorize } from './driver.mjs'

test('OIDC real: discovery, código, PKCE, firma, sesión HTTPS y logout', async (t) => {
  const lab = await startLab()
  t.after(() => lab.close())
  const driver = new BrowserDriver(lab.certificate)
  const start = await driver.request(`${lab.origin}/login`)
  assert.equal(start.status, 302)
  assert.match(
    start.headers['set-cookie'][0],
    /__Host-login=.*; Path=\/; HttpOnly; Secure; SameSite=Lax/,
  )
  const auth = new URL(start.headers.location)
  assert.equal(auth.searchParams.get('code_challenge_method'), 'S256')
  assert.ok(auth.searchParams.get('state'))
  assert.ok(auth.searchParams.get('nonce'))
  const callback = await authorize(driver, auth)
  const done = await driver.request(callback)
  assert.equal(done.status, 303)
  const cookie = done.headers['set-cookie'].find((x) => x.startsWith('__Host-sid='))
  assert.match(cookie, /; Path=\/; HttpOnly; Secure; SameSite=Lax/)
  const me = await driver.request(`${lab.origin}/me`)
  assert.deepEqual(JSON.parse(me.body), { issuer: lab.issuer, sub: 'alice' })
  assert.equal(me.headers['cache-control'], 'no-store')
  assert.equal((await driver.request(callback)).status, 400, 'callback no reutilizable')
  assert.equal(
    (await driver.request(`${lab.origin}/logout`, { method: 'POST' })).status,
    403,
  )
  assert.equal(
    (
      await driver.request(`${lab.origin}/logout`, {
        method: 'POST',
        headers: { origin: 'https://evil.example' },
      })
    ).status,
    403,
  )
  const copied = new BrowserDriver(lab.certificate)
  copied.cookies = new Map(
    [...driver.cookies].map(([origin, jar]) => [origin, new Map(jar)]),
  )
  assert.equal(
    (
      await driver.request(`${lab.origin}/logout`, {
        method: 'POST',
        headers: { origin: lab.origin },
      })
    ).status,
    204,
  )
  assert.equal((await copied.request(`${lab.origin}/me`)).status, 401)
})

test('OIDC: state, nonce alterado y navegador sin cookie no crean sesión', async (t) => {
  const lab = await startLab()
  t.after(() => lab.close())
  for (const attack of ['state', 'nonce', 'cookie']) {
    const driver = new BrowserDriver(lab.certificate)
    const start = await driver.request(`${lab.origin}/login`)
    const auth = new URL(start.headers.location)
    if (attack === 'nonce') auth.searchParams.set('nonce', 'attacker')
    const callback = await authorize(driver, auth)
    if (attack === 'state') callback.searchParams.set('state', 'attacker')
    else driver.cookies.clear()
    assert.equal((await driver.request(callback)).status, 400)
    assert.equal((await driver.request(`${lab.origin}/me`)).status, 401)
  }
})

test('OIDC: proveedor rechaza code_verifier incorrecto', async (t) => {
  const lab = await startLab()
  t.after(() => lab.close())
  const driver = new BrowserDriver(lab.certificate)
  const start = await driver.request(`${lab.origin}/login`)
  const callback = await authorize(driver, new URL(start.headers.location))
  const response = await fetch(`${lab.issuer}/token`, {
    method: 'POST',
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: 'blog-lab',
      code: callback.searchParams.get('code'),
      redirect_uri: `${lab.origin}/callback`,
      code_verifier: oidc.randomPKCECodeVerifier(),
    }),
  })
  assert.equal(response.status, 400)
  assert.equal((await response.json()).error, 'invalid_grant')
})

test('JWT: firma, issuer, audience, exp, nonce y azp se comprueban con JWKS real', async (t) => {
  const { privateKey } = await generateKeyPair('RS256', { extractable: true })
  const jwk = {
    ...(await exportJWK(privateKey)),
    kid: 'test-key',
    alg: 'RS256',
    use: 'sig',
  }
  const lab = await startLab({ signingJwk: jwk })
  t.after(() => lab.close())
  const now = Math.floor(Date.now() / 1000)
  const base = {
    iss: lab.issuer,
    aud: 'blog-lab',
    sub: 'alice',
    iat: now,
    exp: now + 60,
    nonce: 'expected',
  }
  const sign = (claims, key = privateKey) =>
    new SignJWT(claims).setProtectedHeader({ alg: 'RS256', kid: 'test-key' }).sign(key)
  const verify = (token) =>
    verifyIdentityToken(token, {
      issuer: lab.issuer,
      audience: 'blog-lab',
      nonce: 'expected',
      jwks: lab.jwks,
    })
  assert.equal((await verify(await sign(base))).sub, 'alice')
  const { privateKey: attacker } = await generateKeyPair('RS256')
  await assert.rejects(verify(await sign(base, attacker)))
  for (const change of [
    { iss: 'https://other.example' },
    { aud: 'other-client' },
    { exp: now - 1 },
    { nonce: 'other-flow' },
    { aud: ['blog-lab', 'another'] },
    { azp: 'another' },
    { sub: '' },
    { iat: now + 60 },
  ])
    await assert.rejects(
      verify(await sign({ ...base, ...change })),
      JSON.stringify(change),
    )
  const { exp, ...noExpiry } = base
  await assert.rejects(verify(await sign(noExpiry)))
})
