const failure = (status, retryAfter = 1) =>
  Object.assign(new Error('admission_rejected'), { status, retryAfter })
const positiveInteger = (value) => Number.isSafeInteger(value) && value > 0

export function createTokenBucket({
  capacity = 4,
  refillPerSecond = 1,
  now = () => performance.now(),
} = {}) {
  if (
    !positiveInteger(capacity) ||
    !Number.isFinite(refillPerSecond) ||
    refillPerSecond <= 0
  )
    throw new RangeError('Invalid bucket configuration')
  let tokens = capacity
  let last = now()
  if (!Number.isFinite(last)) throw new RangeError('Invalid clock')
  return {
    take(cost = 1) {
      if (!positiveInteger(cost) || cost > capacity)
        throw new RangeError('Invalid token cost')
      const tick = now()
      if (!Number.isFinite(tick)) throw new RangeError('Invalid clock')
      tokens = Math.min(
        capacity,
        tokens + (Math.max(0, tick - last) * refillPerSecond) / 1000,
      )
      last = Math.max(last, tick)
      if (tokens < cost)
        return {
          allowed: false,
          remaining: tokens,
          retryAfter: Math.ceil((cost - tokens) / refillPerSecond),
        }
      tokens -= cost
      return { allowed: true, remaining: tokens, retryAfter: 0 }
    },
  }
}

export function createBulkhead({
  tenants = ['north', 'south'],
  perTenant = 1,
  global: globalLimit = 2,
} = {}) {
  if (
    !positiveInteger(perTenant) ||
    !positiveInteger(globalLimit) ||
    !Array.isArray(tenants) ||
    !tenants.length ||
    new Set(tenants).size !== tenants.length
  )
    throw new RangeError('Invalid bulkhead configuration')
  const active = new Map(tenants.map((tenant) => [tenant, 0]))
  let total = 0
  return {
    acquire(tenantId) {
      if (!active.has(tenantId)) throw failure(403)
      if (active.get(tenantId) >= perTenant) throw failure(429)
      if (total >= globalLimit) throw failure(503)
      active.set(tenantId, active.get(tenantId) + 1)
      total++
      let released = false
      return () => {
        if (released) return
        released = true
        active.set(tenantId, active.get(tenantId) - 1)
        total--
      }
    },
    snapshot: () => ({ total, tenants: Object.fromEntries(active) }),
  }
}

export function createAdmission({
  tenants = ['north', 'south'],
  perTenant = 1,
  global: globalLimit = 2,
  capacity = 4,
  refillPerSecond = 1,
  now = () => performance.now(),
} = {}) {
  const bulkhead = createBulkhead({ tenants, perTenant, global: globalLimit })
  const buckets = new Map(
    tenants.map((tenant) => [
      tenant,
      createTokenBucket({ capacity, refillPerSecond, now }),
    ]),
  )
  return {
    async run(tenantId, work) {
      const release = bulkhead.acquire(tenantId)
      try {
        const decision = buckets.get(tenantId).take()
        if (!decision.allowed) throw failure(429, decision.retryAfter)
        return await work()
      } finally {
        release()
      }
    },
    snapshot: bulkhead.snapshot,
  }
}
