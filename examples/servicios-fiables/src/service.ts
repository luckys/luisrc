import { parseCommand } from './money.ts'
import type { Money } from './money.ts'

type Order = { id: string; money: Money; status: 'created' }
type OrderWriter = { save: (order: Order) => Promise<unknown> }

export async function createOrder(
  writer: OrderWriter,
  id: string,
  input: unknown,
): Promise<Order> {
  const order: Order = { id, money: parseCommand(input), status: 'created' }
  await writer.save(order)
  return order
}

export function problem(code: 'invalid_input' | 'conflict' | 'unexpected') {
  const definitions = {
    invalid_input: { status: 422, title: 'Entrada no válida' },
    conflict: { status: 409, title: 'Conflicto con la operación existente' },
    unexpected: { status: 500, title: 'Error interno' },
  }
  return { type: `https://api.example/problems/${code}`, ...definitions[code], code }
}

type Row = { created_at: string; id: string }
export function pageAfter<T extends Row>(
  rows: T[],
  cursor: Row | undefined,
  limit: number,
): T[] {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100)
    throw new Error('invalid_limit')
  return rows
    .filter(
      (row) =>
        !cursor ||
        row.created_at > cursor.created_at ||
        (row.created_at === cursor.created_at && row.id > cursor.id),
    )
    .sort((a, b) =>
      a.created_at < b.created_at
        ? -1
        : a.created_at > b.created_at
          ? 1
          : a.id < b.id
            ? -1
            : a.id > b.id
              ? 1
              : 0,
    )
    .slice(0, limit)
}

export function operationLog(input: Record<string, unknown>) {
  return {
    operation_id: input.operation_id,
    attempt: input.attempt,
    status: input.status,
  }
}

export function capacity(rps: number, seconds: number): number {
  return rps * seconds
}

// Percentil nearest-rank sobre una muestra completa; no es un histograma distribuido.
export function summarize(latencies: number[], errors: number, target: number) {
  if (
    !latencies.length ||
    errors < 0 ||
    errors > latencies.length ||
    target <= 0 ||
    target >= 1
  )
    throw new Error('invalid_sample')
  const values = [...latencies].sort((a, b) => a - b)
  return {
    count: values.length,
    p95: values[Math.ceil(0.95 * values.length) - 1],
    availability: (values.length - errors) / values.length,
    allowedErrors: values.length * Number((1 - target).toFixed(12)),
  }
}
