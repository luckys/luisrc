import { randomBytes, createHash, timingSafeEqual } from 'node:crypto'
const scopesAllowed = new Set(['documents:read', 'documents:write', 'imports:run'])
const digest = (value) => createHash('sha256').update(value).digest()
const unavailable = () =>
  Object.assign(new Error('credential_store_unavailable'), { status: 503 })

export function parseCredential(header) {
  if (typeof header !== 'string' || header.length > 128) return undefined
  const match = /^Bearer (lab1\.[a-f0-9]{16}\.[a-f0-9]{64})$/i.exec(header)
  if (!match || !/^lab1\.[a-f0-9]{16}\.[a-f0-9]{64}$/.test(match[1])) return undefined
  return { token: match[1], id: match[1].split('.')[1] }
}

export function identifyClient(credentials) {
  return (request) => {
    let count = 0
    for (let index = 0; index < request.rawHeaders.length; index += 2)
      if (request.rawHeaders[index].toLowerCase() === 'authorization') count++
    if (count !== 1) return undefined
    return credentials.verify(request.headers.authorization)
  }
}

export function createCredentials({ now = () => Date.now(), records = new Map() } = {}) {
  let available = true
  const timestamp = () => {
    const time = now()
    if (!Number.isSafeInteger(time) || time < 0) throw unavailable()
    return time
  }
  return {
    issue({ subject, tenantId, scopes, ttlMs }) {
      if (
        typeof subject !== 'string' ||
        !/^[a-z][a-z0-9-]{0,63}$/.test(subject) ||
        !['north', 'south'].includes(tenantId) ||
        !Array.isArray(scopes) ||
        !scopes.every((scope) => scopesAllowed.has(scope)) ||
        !Number.isSafeInteger(ttlMs) ||
        ttlMs <= 0 ||
        ttlMs > 3600000
      )
        throw new RangeError('Invalid credential metadata')
      if (!available) throw unavailable()
      let id
      do {
        id = randomBytes(8).toString('hex')
      } while (records.has(id))
      const token = `lab1.${id}.${randomBytes(32).toString('hex')}`
      records.set(id, {
        digest: digest(token),
        subject,
        tenantId,
        scopes: [...new Set(scopes)],
        expiresAt: timestamp() + ttlMs,
        revoked: false,
      })
      return { id, token }
    },
    verify(header) {
      const parsed = parseCredential(header)
      if (!parsed) return undefined
      if (!available) throw unavailable()
      const record = records.get(parsed.id)
      if (!record || record.revoked || record.expiresAt <= timestamp()) return undefined
      if (!timingSafeEqual(record.digest, digest(parsed.token))) return undefined
      return {
        subject: record.subject,
        tenantId: record.tenantId,
        scopes: [...record.scopes],
      }
    },
    revoke(id) {
      if (!available) throw unavailable()
      const record = records.get(id)
      if (!record) return false
      record.revoked = true
      return true
    },
    setAvailable(value) {
      available = Boolean(value)
    },
  }
}
