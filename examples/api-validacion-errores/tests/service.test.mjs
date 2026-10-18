import test from 'node:test'
import assert from 'node:assert/strict'
import { createInventory, reserve } from '../service.mjs'
import { ApiError } from '../problems.mjs'

const command = { sku: 'BOOK', quantity: 2, expectedVersion: 1, priority: 'standard' }
test('la reserva comprueba versión y stock antes de modificar ambos', () => {
  const inventory = createInventory()
  assert.deepEqual(reserve(inventory, command), { sku: 'BOOK', reserved: 2, version: 2 })
  assert.deepEqual(inventory.get('BOOK'), { stock: 1, version: 2 })
  assert.throws(
    () => reserve(inventory, command),
    (error) => error instanceof ApiError && error.code === 'version_conflict',
  )
  assert.deepEqual(inventory.get('BOOK'), { stock: 1, version: 2 })
  assert.throws(
    () => reserve(inventory, { ...command, expectedVersion: 2 }),
    (error) => error.code === 'out_of_stock',
  )
  assert.deepEqual(inventory.get('BOOK'), { stock: 1, version: 2 })
})

test('recurso inexistente y error de infraestructura no se confunden con stock', () => {
  assert.throws(
    () => reserve(createInventory(), { ...command, sku: 'UNKNOWN' }),
    (error) => error.code === 'not_found',
  )
  const broken = {
    get() {
      throw new Error('password=secret SELECT * FROM inventory')
    },
  }
  assert.throws(() => reserve(broken, command), /password=secret/)
})
