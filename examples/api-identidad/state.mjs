import { randomBytes, createHash } from 'node:crypto'

export const secret = () => randomBytes(32).toString('base64url')
export const digest = (value) =>
  createHash('sha256')
    .update(value ?? '')
    .digest('hex')

export class Sessions {
  records = new Map()

  constructor({ clock = Date.now, ttl = 30 * 60_000 } = {}) {
    this.clock = clock
    this.ttl = ttl
  }

  establish(identity, previous) {
    this.revoke(previous)
    const token = secret()
    this.records.set(digest(token), {
      identity: { ...identity },
      expiresAt: this.clock() + this.ttl,
    })
    return token
  }

  read(token) {
    const record = this.records.get(digest(token))
    if (!record || record.expiresAt <= this.clock()) {
      this.revoke(token)
      return null
    }
    return { ...record.identity }
  }

  revoke(token) {
    this.records.delete(digest(token))
  }
}

// Modelo de rotación, no endpoint OAuth ni servidor de autorización de producción.
export class RefreshFamilies {
  families = new Map()
  refresh = new Map()
  access = new Map()

  constructor({ clock = Date.now, accessTtl = 60_000, familyTtl = 30 * 60_000 } = {}) {
    this.clock = clock
    this.accessTtl = accessTtl
    this.familyTtl = familyTtl
  }

  issue(subject) {
    const id = secret()
    this.families.set(id, {
      subject,
      expiresAt: this.clock() + this.familyTtl,
      revoked: false,
    })
    return this.pair(id)
  }

  pair(familyId) {
    const accessToken = secret()
    const refreshToken = secret()
    const family = this.families.get(familyId)
    this.access.set(digest(accessToken), {
      familyId,
      expiresAt: Math.min(this.clock() + this.accessTtl, family.expiresAt),
    })
    this.refresh.set(digest(refreshToken), { familyId, used: false })
    return { accessToken, refreshToken }
  }

  live(familyId) {
    const family = this.families.get(familyId)
    return family && !family.revoked && family.expiresAt > this.clock() ? family : null
  }

  rotate(token) {
    const record = this.refresh.get(digest(token))
    if (!record || !this.live(record.familyId)) throw new Error('invalid_refresh')
    if (record.used) {
      this.families.get(record.familyId).revoked = true
      throw new Error('refresh_reuse')
    }
    record.used = true
    return this.pair(record.familyId)
  }

  authenticate(token) {
    const record = this.access.get(digest(token))
    if (!record || record.expiresAt <= this.clock()) return null
    return this.live(record.familyId)?.subject ?? null
  }

  revoke(token) {
    const record = this.refresh.get(digest(token))
    if (record) this.families.get(record.familyId).revoked = true
  }
}
