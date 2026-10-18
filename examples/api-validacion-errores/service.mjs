import { ApiError } from './problems.mjs'

export function createInventory() {
  return new Map([['BOOK', { stock: 3, version: 1 }]])
}

export function reserve(inventory, command) {
  const item = inventory.get(command.sku)
  if (!item) throw new ApiError('not_found')
  if (item.version !== command.expectedVersion) throw new ApiError('version_conflict')
  if (item.stock < command.quantity) throw new ApiError('out_of_stock')
  const next = { stock: item.stock - command.quantity, version: item.version + 1 }
  inventory.set(command.sku, next)
  return { sku: command.sku, reserved: command.quantity, version: next.version }
}
