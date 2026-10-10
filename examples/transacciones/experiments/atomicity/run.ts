import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { arch, platform } from 'node:os'
import { createLabDatabase } from './database.js'
import { createWithoutTransaction } from './no-transaction.js'
import { createWithTransaction } from './with-transaction.js'

const database = await createLabDatabase()
const input = () => ({
  orderId: randomUUID(),
  paymentId: randomUUID(),
  amountMinor: '2500',
  currency: 'EUR',
})
async function snapshot(label: string) {
  const { rows } = await database.pool.query(
    'SELECT (SELECT count(*)::int FROM orders) AS orders, (SELECT count(*)::int FROM payments) AS payments',
  )
  console.log(label, JSON.stringify(rows[0]))
}
try {
  const { rows } = await database.pool.query(
    "SELECT current_setting('server_version') AS postgres, current_setting('fsync') AS fsync, current_setting('synchronous_commit') AS synchronous_commit, current_setting('full_page_writes') AS full_page_writes, current_setting('transaction_isolation') AS isolation",
  )
  console.log(
    'Entorno',
    JSON.stringify({
      node: process.version,
      platform: platform(),
      arch: arch(),
      ...rows[0],
    }),
  )
  await snapshot('Sin transacción / antes')
  await assert.rejects(
    createWithoutTransaction(database.pool, input(), true),
    /Fallo inducido/,
  )
  await snapshot('Sin transacción / después del fallo')
  await database.pool.query('TRUNCATE payments, orders')
  await snapshot('Con transacción / antes')
  await assert.rejects(
    createWithTransaction(database.pool, input(), true),
    /Fallo inducido/,
  )
  await snapshot('Con transacción / después del rollback')
  await snapshot('Con transacción / antes del caso correcto')
  await createWithTransaction(database.pool, input())
  await snapshot('Con transacción / después del commit')
  const result = await database.pool.query(
    'SELECT o.total_minor, p.amount_minor, p.currency, p.status FROM payments p JOIN orders o ON o.id = p.order_id',
  )
  console.log('Pago interno confirmado en DB', JSON.stringify(result.rows))
} finally {
  await database.close()
}
