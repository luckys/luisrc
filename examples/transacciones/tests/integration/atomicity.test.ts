import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createLabDatabase } from '../../experiments/atomicity/database.js'
import { createWithoutTransaction } from '../../experiments/atomicity/no-transaction.js'
import { createWithTransaction } from '../../experiments/atomicity/with-transaction.js'

let database: Awaited<ReturnType<typeof createLabDatabase>>
const input = () => ({
  orderId: randomUUID(),
  paymentId: randomUUID(),
  amountMinor: '2500',
  currency: 'EUR',
})
async function counts() {
  const result = await database.pool.query<{ orders: number; payments: number }>(
    'SELECT (SELECT count(*)::int FROM orders) AS orders, (SELECT count(*)::int FROM payments) AS payments',
  )
  return result.rows[0]
}

beforeAll(async () => {
  database = await createLabDatabase()
})
beforeEach(async () => {
  await database.pool.query('TRUNCATE payments, orders')
})
afterAll(async () => {
  await database?.close()
})

describe('Transacciones: efecto persistido, no solo respuesta de la función', () => {
  it('reproduce el pedido sin pago al fallar entre escrituras independientes', async () => {
    await expect(createWithoutTransaction(database.pool, input(), true)).rejects.toThrow(
      'Fallo inducido',
    )
    expect(await counts()).toEqual({ orders: 1, payments: 0 })
  })
  it('no deja ninguna fila al fallar entre escrituras de una transacción', async () => {
    await expect(createWithTransaction(database.pool, input(), true)).rejects.toThrow(
      'Fallo inducido',
    )
    expect(await counts()).toEqual({ orders: 0, payments: 0 })
  })
  it('confirma ambas filas con los mismos importes y moneda', async () => {
    const request = input()
    await createWithTransaction(database.pool, request)
    expect(await counts()).toEqual({ orders: 1, payments: 1 })
    const { rows } = await database.pool.query(
      'SELECT p.order_id, o.total_minor, p.amount_minor, p.currency, p.status FROM payments p JOIN orders o ON o.id = p.order_id',
    )
    expect(rows).toEqual([
      {
        order_id: request.orderId,
        total_minor: '2500',
        amount_minor: '2500',
        currency: 'EUR',
        status: 'created',
      },
    ])
  })
  it('revierte el pedido si la segunda escritura falla en PostgreSQL', async () => {
    await expect(
      createWithTransaction(database.pool, {
        ...input(),
        amountMinor: '9223372036854775807',
      }),
    ).resolves.toBeUndefined()
    // Reutilizar un paymentId provoca una violación de PK después de insertar otro pedido.
    const payment = await database.pool.query<{ id: string }>('SELECT id FROM payments')
    await expect(
      createWithTransaction(database.pool, {
        ...input(),
        paymentId: payment.rows[0]!.id,
      }),
    ).rejects.toMatchObject({ code: '23505' })
    expect(await counts()).toEqual({ orders: 1, payments: 1 })
  })
  it('una sesión observadora no ve escrituras sin confirmar', async () => {
    const client = await database.pool.connect()
    try {
      await client.query('BEGIN')
      await client.query(
        'INSERT INTO orders (id, total_minor, currency) VALUES ($1, 2500, $2)',
        [randomUUID(), 'EUR'],
      )
      expect(await counts()).toEqual({ orders: 0, payments: 0 })
    } finally {
      await client.query('ROLLBACK')
      client.release()
    }
  })
  it('un error SQL bloquea la transacción hasta rollback o rollback a un savepoint', async () => {
    const client = await database.pool.connect()
    const request = input()
    try {
      await client.query('BEGIN')
      await client.query(
        'INSERT INTO orders (id, total_minor, currency) VALUES ($1, 2500, $2)',
        [request.orderId, 'EUR'],
      )
      await client.query('SAVEPOINT optional_work')
      await expect(client.query('SELECT 1 / 0')).rejects.toMatchObject({ code: '22012' })
      await expect(client.query('SELECT 1')).rejects.toMatchObject({ code: '25P02' })
      await client.query('ROLLBACK TO SAVEPOINT optional_work')
      await client.query(
        'INSERT INTO payments (id, order_id, amount_minor, currency) VALUES ($1, $2, 2500, $3)',
        [request.paymentId, request.orderId, 'EUR'],
      )
      await client.query('RELEASE SAVEPOINT optional_work')
      expect(await counts()).toEqual({ orders: 0, payments: 0 })
      await client.query('COMMIT')
      expect(await counts()).toEqual({ orders: 1, payments: 1 })
    } finally {
      await client.query('ROLLBACK')
      client.release()
    }
  })
  it('cerrar una sesión antes de COMMIT descarta sus escrituras', async () => {
    const client = await database.pool.connect()
    const { rows } = await client.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')
    try {
      await client.query('BEGIN')
      await client.query(
        'INSERT INTO orders (id, total_minor, currency) VALUES ($1, 2500, $2)',
        [randomUUID(), 'EUR'],
      )
    } finally {
      client.release(true)
    }
    // Esperar el cierre del backend evita confundir invisibilidad con rollback efectivo.
    await expect
      .poll(
        async () => {
          const result = await database.pool.query(
            'SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE pid = $1) AS active',
            [rows[0]!.pid],
          )
          return result.rows[0].active
        },
        { timeout: 3000 },
      )
      .toBe(false)
    expect(await counts()).toEqual({ orders: 0, payments: 0 })
  })
  it('una transacción puede confirmar un importe negativo si nadie lo prohíbe', async () => {
    await createWithTransaction(database.pool, { ...input(), amountMinor: '-2500' })
    const result = await database.pool.query('SELECT amount_minor FROM payments')
    expect(result.rows).toEqual([{ amount_minor: '-2500' }])
  })
  it('COMMIT sobre un bloque abortado termina con ROLLBACK, no con confirmación', async () => {
    const client = await database.pool.connect()
    try {
      await client.query('BEGIN')
      await client.query(
        'INSERT INTO orders (id, total_minor, currency) VALUES ($1, 2500, $2)',
        [randomUUID(), 'EUR'],
      )
      await expect(client.query('SELECT 1 / 0')).rejects.toMatchObject({ code: '22012' })
      const result = await client.query('COMMIT')
      expect(result.command).toBe('ROLLBACK')
      expect(await counts()).toEqual({ orders: 0, payments: 0 })
    } finally {
      await client.query('ROLLBACK')
      client.release()
    }
  })
})
