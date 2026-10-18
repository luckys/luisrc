import test from 'node:test'
import assert from 'node:assert/strict'
import { simulateChange } from '../model.mjs'
test('modelo: inserción reproduce los IDs de la observación SQL y no repite con keyset', () => {
  const result = simulateChange('insert')
  assert.deepEqual(result.offset, ['999988', '999986', '999984', '999982', '999978'])
  assert.deepEqual(result.keyset, ['999986', '999984', '999982', '999978', '999976'])
})
test('modelo: una clave mutable repite un ID con keyset; snapshot conserva la vista', () => {
  const result = simulateChange('move')
  assert.ok(result.keyset.includes(result.first[0]))
  assert.deepEqual(result.snapshot, simulateChange('none').snapshot)
})
test('modelo: borrar delante omite una fila con offset; entradas desconocidas se rechazan', () => {
  const result = simulateChange('delete')
  assert.ok(!result.offset.includes('999986'))
  assert.ok(result.keyset.includes('999986'))
  assert.throws(() => simulateChange('unknown'))
})
