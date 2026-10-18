import { createHmac, timingSafeEqual } from 'node:crypto'

export class InputError extends Error {}

export function parsePage(params) {
  if (
    [...params.keys()].some((key) => !['pageSize', 'status', 'after'].includes(key)) ||
    ['pageSize', 'status', 'after'].some((key) => params.getAll(key).length > 1)
  )
    throw new InputError('invalid_query')
  const size = params.get('pageSize') ?? '50'
  const status = params.get('status') ?? 'paid'
  const after = params.get('after')
  if (
    !/^[1-9][0-9]{0,2}$/.test(size) ||
    +size > 100 ||
    !['paid', 'pending'].includes(status) ||
    (after !== null && !after)
  )
    throw new InputError('invalid_query')
  return { pageSize: +size, status, after }
}

export function createCursor(key, now = Date.now) {
  if (!Buffer.isBuffer(key) || key.length < 32) throw new Error('invalid_key')
  const sign = (value) => createHmac('sha256', key).update(value).digest()
  return {
    encode(row, scope) {
      const payload = Buffer.from(
        JSON.stringify({
          v: 1,
          scope,
          id: row.id,
          createdAt: row.created_at.toISOString(),
          expires: now() + 3600000,
        }),
      ).toString('base64url')
      return `${payload}.${sign(payload).toString('base64url')}`
    },
    decode(token, scope) {
      try {
        if (
          typeof token !== 'string' ||
          token.length > 2048 ||
          !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)
        )
          throw new Error()
        const [payload, signature] = token.split('.')
        const received = Buffer.from(signature, 'base64url')
        const expected = sign(payload)
        if (received.length !== expected.length || !timingSafeEqual(received, expected))
          throw new Error()
        const value = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
        if (
          value.v !== 1 ||
          value.scope !== scope ||
          !Number.isSafeInteger(value.expires) ||
          value.expires <= now() ||
          typeof value.id !== 'string' ||
          !/^[1-9][0-9]{0,18}$/.test(value.id) ||
          BigInt(value.id) > 9223372036854775807n ||
          typeof value.createdAt !== 'string' ||
          new Date(value.createdAt).toISOString() !== value.createdAt
        )
          throw new Error()
        return { id: value.id, createdAt: value.createdAt }
      } catch {
        throw new InputError('invalid_cursor')
      }
    },
  }
}
