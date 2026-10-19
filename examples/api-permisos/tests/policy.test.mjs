import test from 'node:test'
import assert from 'node:assert/strict'
import { can } from '../policy.mjs'

const context = { subject: 'alice', role: 'editor', tenantId: 'north' }
const document = { tenantId: 'north', ownerId: 'alice', state: 'draft' }

test('policy: ownership no concede escritura sin el rol adecuado', () => {
  assert.equal(can(context, 'write', document), true)
  assert.equal(can({ ...context, role: 'reader' }, 'write', document), false)
  assert.equal(can(context, 'write', { ...document, ownerId: 'bob' }), false)
  assert.equal(
    can({ ...context, role: 'admin' }, 'write', { ...document, ownerId: 'bob' }),
    true,
  )
})

test('policy: estado y tenant restringen también a admin', () => {
  const admin = { ...context, role: 'admin' }
  for (const state of ['published', 'archived'])
    assert.equal(can(admin, 'write', { ...document, state }), false)
  assert.equal(can(admin, 'read', { ...document, tenantId: 'south' }), false)
  assert.equal(can(admin, 'write', { ...document, tenantId: 'south' }), false)
})

test('policy: published significa visible a miembros, no público en Internet', () => {
  const other = { ...document, ownerId: 'bob', state: 'published' }
  assert.equal(can({ ...context, role: 'reader' }, 'read', other), true)
  assert.equal(can({ ...context, role: undefined }, 'read', other), false)
  assert.equal(can(context, 'read', { ...other, state: 'draft' }), false)
})

test('policy: denegar acciones, roles, contexto o recursos desconocidos', () => {
  assert.equal(can(context, 'export', document), false)
  assert.equal(can({ ...context, role: 'superadmin' }, 'read', document), false)
  assert.equal(can(context, 'read', undefined), false)
  assert.equal(can({}, 'read', document), false)
  assert.equal(can(null, 'read', document), false)
  assert.equal(
    can({ subject: 'alice', role: 'admin' }, 'read', {
      ownerId: 'alice',
      state: 'draft',
    }),
    false,
  )
  assert.equal(can(context, 'read', { ...document, state: 'unknown' }), false)
  assert.equal(can(context, 'read', { tenantId: 'north', state: 'published' }), false)
})

test('policy: matriz independiente de roles, ownership y estado', () => {
  const rows = [
    ['reader', true, 'draft', true, false],
    ['reader', false, 'draft', false, false],
    ['reader', false, 'published', true, false],
    ['editor', true, 'draft', true, true],
    ['editor', false, 'draft', false, false],
    ['editor', true, 'published', true, false],
    ['editor', true, 'archived', true, false],
    ['admin', false, 'draft', true, true],
    ['admin', false, 'published', true, false],
    ['admin', false, 'archived', true, false],
  ]
  for (const [role, owns, state, read, write] of rows) {
    const ctx = { ...context, role }
    const doc = { ...document, ownerId: owns ? 'alice' : 'bob', state }
    assert.equal(can(ctx, 'read', doc), read, JSON.stringify([role, owns, state, 'read']))
    assert.equal(
      can(ctx, 'write', doc),
      write,
      JSON.stringify([role, owns, state, 'write']),
    )
  }
})
