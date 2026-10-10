import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { Pool } from 'pg'

export async function createLabDatabase() {
  const schema = `tx_${randomUUID().replaceAll('-', '')}`
  // No se acepta una URL externa: los tests solo conectan al laboratorio local.
  const configuration = {
    host: '127.0.0.1',
    port: Number(process.env.TRANSACTIONS_DB_PORT ?? 55434),
    database: 'transactions_lab',
    user: 'lab',
    password: 'local-lab-only',
    connectionTimeoutMillis: 5000,
  }
  const admin = new Pool(configuration)
  const pool = new Pool({ ...configuration, options: `-c search_path=${schema},public` })
  let schemaCreated = false
  async function close() {
    try {
      await pool.end()
    } finally {
      try {
        if (schemaCreated) await admin.query(`DROP SCHEMA ${schema} CASCADE`)
      } finally {
        await admin.end()
      }
    }
  }
  try {
    await admin.query(`CREATE SCHEMA ${schema}`)
    schemaCreated = true
    const migration = await readFile(
      new URL('../../db/migrations/001_init.sql', import.meta.url),
      'utf8',
    )
    await pool.query(migration)
  } catch (error) {
    try {
      await close()
    } catch (cleanupError) {
      throw new AggregateError(
        [error, cleanupError],
        'Inicialización y limpieza fallidas',
      )
    }
    throw error
  }
  return { pool, close }
}
