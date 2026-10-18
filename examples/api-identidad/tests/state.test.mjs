import test from 'node:test'
import assert from 'node:assert/strict'
import { Sessions, RefreshFamilies, digest } from '../state.mjs'

test('session: secreto aleatorio, hash en almacenamiento y rotación contra fixation', () => {
  const sessions = new Sessions()
  const old = sessions.establish({ issuer: 'test', sub: 'alice' })
  const current = sessions.establish({ issuer: 'test', sub: 'alice' }, old)
  assert.notEqual(old, current)
  assert.equal(Buffer.from(current, 'base64url').length, 32)
  assert.equal(sessions.read(old), null)
  assert.deepEqual(sessions.read(current), { issuer: 'test', sub: 'alice' })
  assert.ok(sessions.records.has(digest(current)))
  assert.ok(!sessions.records.has(current))
})

test('session: expiración absoluta sin sleeps y logout invalida una copia', () => {
  let now = 1000
  const sessions = new Sessions({ clock: () => now, ttl: 100 })
  const first = sessions.establish({ issuer: 'test', sub: 'alice' })
  now = 1100
  assert.equal(sessions.read(first), null)
  const next = sessions.establish({ issuer: 'test', sub: 'alice' })
  sessions.revoke(next)
  assert.equal(sessions.read(next), null)
  assert.equal(sessions.read('invented'), null)
})

test('refresh: rotar consume el anterior; reutilizarlo revoca toda la familia', () => {
  const tokens = new RefreshFamilies()
  const first = tokens.issue('alice')
  const next = tokens.rotate(first.refreshToken)
  assert.notEqual(next.refreshToken, first.refreshToken)
  assert.equal(tokens.authenticate(next.accessToken), 'alice')
  assert.throws(() => tokens.rotate(first.refreshToken), /refresh_reuse/)
  assert.equal(tokens.authenticate(first.accessToken), null)
  assert.equal(tokens.authenticate(next.accessToken), null)
  assert.throws(() => tokens.rotate(next.refreshToken), /invalid_refresh/)
})

test('refresh: dos solicitudes con el mismo token revocan incluso al primer sucesor', async () => {
  const tokens = new RefreshFamilies()
  const first = tokens.issue('alice')
  const result = await Promise.allSettled([
    Promise.resolve().then(() => tokens.rotate(first.refreshToken)),
    Promise.resolve().then(() => tokens.rotate(first.refreshToken)),
  ])
  assert.deepEqual(
    result.map((x) => x.status),
    ['fulfilled', 'rejected'],
  )
  assert.equal(tokens.authenticate(result[0].value.accessToken), null)
})

test('refresh: access corto, renovación antes del límite absoluto y límite no deslizante', () => {
  let now = 1000
  const tokens = new RefreshFamilies({ clock: () => now, accessTtl: 10, familyTtl: 100 })
  const first = tokens.issue('alice')
  now = 1010
  assert.equal(tokens.authenticate(first.accessToken), null)
  now = 1099
  const next = tokens.rotate(first.refreshToken)
  assert.equal(tokens.authenticate(next.accessToken), 'alice')
  now = 1100
  assert.equal(tokens.authenticate(next.accessToken), null)
  assert.throws(() => tokens.rotate(next.refreshToken), /invalid_refresh/)
})

test('refresh: revocación aislada por familia y credenciales desconocidas', () => {
  const tokens = new RefreshFamilies()
  const alice = tokens.issue('alice')
  const bob = tokens.issue('bob')
  tokens.revoke(alice.refreshToken)
  assert.equal(tokens.authenticate(alice.accessToken), null)
  assert.equal(tokens.authenticate(bob.accessToken), 'bob')
  assert.equal(tokens.authenticate('invented'), null)
  assert.throws(() => tokens.rotate('invented'), /invalid_refresh/)
  assert.ok(!tokens.refresh.has(alice.refreshToken))
  assert.ok(tokens.refresh.has(digest(alice.refreshToken)))
})
