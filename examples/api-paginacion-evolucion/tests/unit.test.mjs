import test from 'node:test'
import assert from 'node:assert/strict'
import { createCursor, parsePage } from '../pagination.mjs'
import { formatOrder } from '../representations.mjs'
import { readV1, readV2 } from '../clients.mjs'

const key = Buffer.alloc(32, 7) // Solo fixture pública del test, no secreto operativo.
const row = {
  id: '9007199254740993',
  created_at: new Date('2026-01-01T00:00:00.001Z'),
  amount_minor: 1250,
  currency: 'EUR',
  status: 'paid',
  description: 'Libro',
}
test('cursor conserva bigint como string, timestamp y ámbito; caduca y detecta alteración', () => {
  const cursors = createCursor(key, () => 1000)
  const token = cursors.encode(row, 'v1:1:paid')
  assert.deepEqual(cursors.decode(token, 'v1:1:paid'), {
    id: row.id,
    createdAt: row.created_at.toISOString(),
  })
  assert.throws(() => cursors.decode(token, 'v1:1:pending'), /invalid_cursor/)
  assert.throws(() => cursors.decode(token, 'v2:1:paid'), /invalid_cursor/)
  assert.throws(() => cursors.decode(`x${token.slice(1)}`, 'v1:1:paid'), /invalid_cursor/)
  assert.throws(
    () => createCursor(key, () => 3601001).decode(token, 'v1:1:paid'),
    /invalid_cursor/,
  )
  for (const bad of ['', 'x', 'a'.repeat(2049), 'a.b.c'])
    assert.throws(() => cursors.decode(bad, 'v1:1:paid'))
})

test('parámetros públicos acotados y sin duplicados ni sort SQL arbitrario', () => {
  assert.deepEqual(parsePage(new URLSearchParams()), {
    pageSize: 50,
    status: 'paid',
    after: null,
  })
  for (const query of [
    'pageSize=0',
    'pageSize=101',
    'pageSize=2.5',
    'pageSize=1&pageSize=2',
    'sort=id;DROP',
    'status=unknown',
    'after=',
  ])
    assert.throws(() => parsePage(new URLSearchParams(query)), /invalid_query/)
})

test('cliente antiguo tolera label aditivo, no interpreta otra unidad o nombre', () => {
  const baseline = { items: [formatOrder(row, 'v1', 'baseline')], nextCursor: null }
  const additive = { items: [formatOrder(row, 'v1', 'additive')], nextCursor: null }
  assert.deepEqual(readV1(baseline), [1250])
  assert.deepEqual(readV1(additive), [1250])
  assert.throws(
    () => readV1({ items: [formatOrder(row, 'v1', 'breaking')], nextCursor: null }),
    /contract_v1/,
  )
  assert.throws(
    () =>
      readV1({ items: [{ ...baseline.items[0], status: 'refunded' }], nextCursor: null }),
    /contract_v1/,
  )
})

test('cliente nuevo utiliza money y no depende de la representación antigua', () => {
  assert.deepEqual(readV2({ items: [formatOrder(row, 'v2')], nextCursor: null }), [1250])
  assert.throws(
    () => readV2({ items: [formatOrder(row, 'v1')], nextCursor: null }),
    /contract_v2/,
  )
})
