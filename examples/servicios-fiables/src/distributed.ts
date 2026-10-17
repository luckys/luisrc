// Modelo de coordinación dentro de UN proceso. No es persistencia ni un lock distribuido.
export class IdempotencyMemory {
  private records = new Map<string, { fingerprint: string; result: Promise<string> }>()

  async run(
    scopeKey: string,
    fingerprint: string,
    effect: () => Promise<string>,
  ): Promise<string> {
    const previous = this.records.get(scopeKey)
    if (previous) {
      if (previous.fingerprint !== fingerprint) throw new Error('conflict')
      return previous.result
    }
    const result = Promise.resolve().then(effect)
    this.records.set(scopeKey, { fingerprint, result })
    return result
  }
}

export class ProviderFake {
  effects = 0
  private operations = new Map<string, 'succeeded'>()

  async execute(id: string, loseResponse = false): Promise<'succeeded'> {
    if (!this.operations.has(id)) {
      this.effects++
      this.operations.set(id, 'succeeded')
    }
    if (loseResponse) throw new Error('response_lost')
    return 'succeeded'
  }

  lookup(id: string): 'succeeded' | 'not_found' {
    return this.operations.get(id) ?? 'not_found'
  }
}

export function fullJitter(
  attempt: number,
  base: number,
  cap: number,
  random: () => number,
): number {
  return Math.floor(random() * Math.min(cap, base * 2 ** attempt))
}

type RetryOptions = {
  maxAttempts: number
  deadline: number
  base: number
  cap: number
  now: () => number
  sleep: (ms: number) => Promise<void>
  random: () => number
}

// La operación recibe el tiempo restante y debe imponer su propio timeout/cancelación.
export async function retry<T>(
  operation: (remainingMs: number) => Promise<T>,
  retryable: (error: unknown) => boolean,
  options: RetryOptions,
): Promise<T> {
  for (let attempt = 0; attempt < options.maxAttempts; attempt++) {
    const remaining = options.deadline - options.now()
    if (remaining <= 0) throw new Error('deadline')
    try {
      return await operation(remaining)
    } catch (error) {
      if (!retryable(error) || attempt + 1 === options.maxAttempts) throw error
      const wait = fullJitter(attempt, options.base, options.cap, options.random)
      if (options.now() + wait >= options.deadline) throw new Error('deadline')
      await options.sleep(wait)
    }
  }
  throw new Error('no_attempts')
}

export class Bulkhead {
  private active = 0
  constructor(privateLimit: number) {
    if (!Number.isInteger(privateLimit) || privateLimit < 1)
      throw new Error('invalid_limit')
    this.limit = privateLimit
  }
  private limit: number
  async run<T>(task: () => Promise<T>): Promise<T> {
    if (this.active >= this.limit) throw new Error('overloaded')
    this.active++
    try {
      return await task()
    } finally {
      this.active--
    }
  }
}

type Job = { id: string; done: boolean; until: number; token: number }
export class LeaseQueue {
  private jobs: Job[] = []
  private sequence = 0
  add(id: string): void {
    if (this.jobs.some((job) => job.id === id)) throw new Error('duplicate_job')
    this.jobs.push({ id, done: false, until: 0, token: 0 })
  }
  claim(now: number, duration: number): { id: string; token: number } | undefined {
    const job = this.jobs.find((job) => !job.done && job.until <= now)
    if (!job) return undefined
    job.until = now + duration
    job.token = ++this.sequence
    return { id: job.id, token: job.token }
  }
  ack(id: string, token: number): boolean {
    const job = this.jobs.find((job) => job.id === id && job.token === token && !job.done)
    if (!job) return false
    job.done = true
    return true
  }
}
