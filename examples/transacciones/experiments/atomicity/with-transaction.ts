import type { Pool } from 'pg'
import type { CreationInput } from './types.js'

export async function createWithTransaction(
  pool: Pool,
  input: CreationInput,
  failAfterOrder = false,
) {
  const client = await pool.connect()
  let discardClient = false
  try {
    await client.query('BEGIN')
    await client.query(
      'INSERT INTO orders (id, total_minor, currency) VALUES ($1, $2, $3)',
      [input.orderId, input.amountMinor, input.currency],
    )
    if (failAfterOrder) throw new Error('Fallo inducido después de crear el pedido')
    await client.query(
      'INSERT INTO payments (id, order_id, amount_minor, currency) VALUES ($1, $2, $3, $4)',
      [input.paymentId, input.orderId, input.amountMinor, input.currency],
    )
    await client.query('COMMIT')
  } catch (error) {
    try {
      await client.query('ROLLBACK')
    } catch (rollbackError) {
      discardClient = true
      throw new AggregateError(
        [error, rollbackError],
        'Operación fallida; rollback no confirmado',
      )
    }
    throw error
  } finally {
    client.release(discardClient)
  }
}
