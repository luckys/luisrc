import { createHmac, timingSafeEqual } from 'node:crypto'

// Protocolo ficticio de la serie; no es la implementación de un PSP concreto.
export function sign(raw: string, timestamp: number, secret: string): string {
  return createHmac('sha256', secret).update(`${timestamp}.${raw}`, 'utf8').digest('hex')
}

export function verify(
  raw: string,
  timestamp: number,
  signature: string,
  secret: string,
  now: number,
): boolean {
  if (!Number.isSafeInteger(timestamp) || Math.abs(now - timestamp) > 300) return false
  if (!/^[a-f0-9]{64}$/.test(signature)) return false
  const actual = Buffer.from(signature, 'hex')
  const expected = Buffer.from(sign(raw, timestamp, secret), 'hex')
  return timingSafeEqual(actual, expected)
}
