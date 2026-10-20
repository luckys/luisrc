import { createTokenBucket } from './admission.mjs'
const schedules = {
  burst: [
    [0, 'north'],
    [0, 'north'],
    [0, 'north'],
    [0, 'north'],
    [0, 'north'],
    [500, 'north'],
    [1000, 'north'],
    [1000, 'south'],
  ],
  sustained: Array.from({ length: 8 }, (_, index) => [index * 1000, 'north']),
  tenants: [
    [0, 'north'],
    [0, 'north'],
    [0, 'south'],
    [0, 'north'],
    [0, 'north'],
    [0, 'north'],
    [500, 'south'],
    [1000, 'north'],
  ],
}

export function simulateQuota({
  capacity = 4,
  refillPerSecond = 1,
  scenario = 'burst',
} = {}) {
  if (!Object.hasOwn(schedules, scenario)) throw new RangeError('Unknown quota scenario')
  let time = 0
  const buckets = new Map(
    ['north', 'south'].map((tenant) => [
      tenant,
      createTokenBucket({ capacity, refillPerSecond, now: () => time }),
    ]),
  )
  return schedules[scenario].map(([at, tenant]) => {
    time = at
    return { at, tenant, ...buckets.get(tenant).take() }
  })
}
