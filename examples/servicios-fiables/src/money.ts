export type Money = Readonly<{ amount_minor: number; currency: 'EUR' }>

export function parseMoney(value: unknown): Money {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('invalid_money')
  }
  const input = value as Record<string, unknown>
  if (!Number.isSafeInteger(input.amount_minor) || (input.amount_minor as number) <= 0) {
    throw new Error('invalid_amount')
  }
  if (input.currency !== 'EUR') throw new Error('unsupported_currency')
  return Object.freeze({ amount_minor: input.amount_minor as number, currency: 'EUR' })
}

export function parseCommand(value: unknown): Money {
  const money = parseMoney(value)
  const keys = Object.keys(value as object)
  if (keys.some((key) => !['amount_minor', 'currency'].includes(key))) {
    throw new Error('unexpected_field')
  }
  return money
}
