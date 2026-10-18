const ids = [
  '999998',
  '999996',
  '999994',
  '999992',
  '999988',
  '999986',
  '999984',
  '999982',
  '999978',
  '999976',
]
const order = (a, b) => b.createdAt - a.createdAt || Number(b.id) - Number(a.id)
const after = (row, cursor) =>
  row.createdAt < cursor.createdAt ||
  (row.createdAt === cursor.createdAt && Number(row.id) < Number(cursor.id))

export function simulateChange(change) {
  if (!['none', 'insert', 'move', 'delete'].includes(change))
    throw new Error('invalid_change')
  // Solo estos IDs pequeños del modelo; el servidor real NO convierte bigint a Number.
  const original = ids.map((id) => ({ id, createdAt: Math.floor(Number(id) / 10) }))
  const first = original.slice(0, 5)
  const cursor = first.at(-1)
  const changed = original.map((row) => ({ ...row }))
  if (change === 'insert') changed.push({ id: '2000001', createdAt: 2000000 })
  if (change === 'move') changed[0].createdAt = cursor.createdAt - 1
  if (change === 'delete') changed.shift()
  changed.sort(order)
  return {
    first: first.map((x) => x.id),
    offset: changed.slice(5, 10).map((x) => x.id),
    keyset: changed
      .filter((row) => after(row, cursor))
      .slice(0, 5)
      .map((x) => x.id),
    snapshot: original.slice(5, 10).map((x) => x.id),
  }
}
