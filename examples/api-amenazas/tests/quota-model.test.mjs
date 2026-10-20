import test from 'node:test'
import assert from 'node:assert/strict'
import { simulateQuota } from '../quota-model.mjs'

test('T06: modelo del visor comparte bucket pero contrasta saldos y decisiones con expectativas independientes', () => {
  const rows = simulateQuota()
  assert.deepEqual(
    rows.map((row) => row.allowed),
    [true, true, true, true, false, false, true, true],
  )
  assert.deepEqual(
    rows.map((row) => row.remaining),
    [3, 2, 1, 0, 0, 0.5, 0, 3],
  )
  assert.equal(rows[5].retryAfter, 1)
  assert.ok(simulateQuota({ scenario: 'sustained' }).every((row) => row.allowed))
  const tenants = simulateQuota({ scenario: 'tenants' })
  assert.equal(tenants[5].allowed, false)
  assert.equal(tenants[6].allowed, true)
  assert.equal(simulateQuota({ capacity: 1 })[1].allowed, false)
  assert.equal(simulateQuota({ capacity: 1, refillPerSecond: 2 })[5].allowed, true)
  assert.throws(() => simulateQuota({ scenario: '__proto__' }), RangeError)
})
