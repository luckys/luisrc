import test from 'node:test'
import assert from 'node:assert/strict'
import { parseMoney, parseCommand } from '../src/money.ts'
import { canRead, allowMutation, allowedDestination } from '../src/security.ts'
import { transition, reconcile, compensate } from '../src/workflow.ts'
import {
  IdempotencyMemory,
  ProviderFake,
  retry,
  LeaseQueue,
  fullJitter,
  Bulkhead,
} from '../src/distributed.ts'
import { sign, verify } from '../src/webhook.ts'
import {
  createOrder,
  problem,
  pageAfter,
  operationLog,
  summarize,
  capacity,
} from '../src/service.ts'

test('money: representación exacta EUR y rechazo de datos inválidos', () => {
  assert.equal(0.1 + 0.2 === 0.3, false)
  assert.deepEqual(parseMoney({ amount_minor: 30, currency: 'EUR' }), {
    amount_minor: 30,
    currency: 'EUR',
  })
  for (const value of [
    null,
    {},
    { amount_minor: 1.5, currency: 'EUR' },
    { amount_minor: Number.MAX_SAFE_INTEGER + 1, currency: 'EUR' },
    { amount_minor: 10, currency: 'USD' },
  ])
    assert.throws(() => parseMoney(value))
  assert.throws(() =>
    parseCommand({ amount_minor: 10, currency: 'EUR', status: 'succeeded' }),
  )
})

test('dos tareas pueden leer la misma versión antes de escribir', async () => {
  let balance = 0
  let arrived = 0
  let release
  const gate = new Promise((resolve) => {
    release = resolve
  })
  async function broken() {
    const old = balance
    if (++arrived === 2) release()
    await gate
    balance = old + 1
  }
  await Promise.all([broken(), broken()])
  assert.equal(balance, 1)
})

test('autorización por objeto: el rol no salta la frontera del tenant', () => {
  const order = { tenant: 'a', owner: 'u1' }
  assert.equal(canRead({ tenant: 'b', user: 'u1', role: 'admin' }, order), false)
  assert.equal(canRead({ tenant: 'a', user: 'u2', role: 'reader' }, order), false)
  assert.equal(canRead({ tenant: 'a', user: 'u2', role: 'admin' }, order), true)
  assert.equal(canRead({ tenant: 'a', user: 'u1', role: 'reader' }, order), true)
})

test('controles de frontera: origen, CSRF y allowlist de destino', () => {
  assert.equal(allowMutation('https://shop.example', 'same', 'same'), true)
  assert.equal(allowMutation('https://evil.example', 'same', 'same'), false)
  assert.equal(allowMutation('https://shop.example', 'wrong', 'same'), false)
  assert.equal(allowMutation(undefined, 'same', 'same'), false)
  assert.equal(allowedDestination('https://provider.example/v1/status'), true)
  assert.equal(allowedDestination('https://provider.example.evil.test/v1/status'), false)
  assert.equal(allowedDestination('http://127.0.0.1/admin'), false)
})

test('máquina: duplicados no repiten transición y terminales no retroceden', () => {
  assert.equal(transition('created', 'submit'), 'processing')
  assert.equal(transition('processing', 'uncertain'), 'unknown')
  assert.equal(transition('unknown', 'confirm'), 'succeeded')
  assert.equal(transition('succeeded', 'confirm'), 'succeeded')
  assert.throws(() => transition('succeeded', 'decline'))
  assert.throws(() => transition('created', 'confirm'))
})

test('caso de uso y contrato de error sin depender de HTTP ni PostgreSQL', async () => {
  const saved = []
  const result = await createOrder({ save: async (order) => saved.push(order) }, 'o1', {
    amount_minor: 1200,
    currency: 'EUR',
  })
  assert.equal(result.status, 'created')
  assert.equal(saved.length, 1)
  await assert.rejects(
    createOrder(
      {
        save: async () => {
          throw new Error('offline')
        },
      },
      'o2',
      { amount_minor: 1, currency: 'EUR' },
    ),
  )
  assert.equal(problem('invalid_input').status, 422)
  assert.equal(problem('conflict').status, 409)
  assert.ok(!JSON.stringify(problem('unexpected')).includes('stack'))
})

test('cursor compuesto avanza sin perder empates; campo aditivo tolerado', () => {
  const rows = [
    { created_at: '2026-01-01', id: 'a' },
    { created_at: '2026-01-01', id: 'b' },
    { created_at: '2026-01-02', id: 'c' },
  ]
  const first = pageAfter(rows, undefined, 1)
  const second = pageAfter(rows, first.at(-1), 1)
  assert.equal(second[0].id, 'b')
  const oldClient = ({ id }) => id
  assert.equal(oldClient({ id: 'o1', new_field: true }), 'o1')
})

test('timeout tras efecto y retry con/sin identificador estable', async () => {
  const provider = new ProviderFake()
  await assert.rejects(provider.execute('stable', true))
  assert.equal(provider.effects, 1)
  assert.equal(provider.lookup('stable'), 'succeeded')
  await provider.execute('stable')
  assert.equal(provider.effects, 1)
  await provider.execute('new-id')
  assert.equal(provider.effects, 2)
})

test('idempotencia local: 100 llamadas, un efecto y payload distinto rechazado', async () => {
  const records = new IdempotencyMemory()
  let effects = 0
  const tasks = Array.from({ length: 100 }, () =>
    records.run('tenant:a:create:key1', 'EUR:1200', async () => {
      effects++
      return 'o1'
    }),
  )
  assert.deepEqual(new Set(await Promise.all(tasks)), new Set(['o1']))
  assert.equal(effects, 1)
  await assert.rejects(
    records.run('tenant:a:create:key1', 'EUR:1300', async () => 'wrong'),
    /conflict/,
  )
})

test('jitter acotado; deadline incluye espera y quedan explícitos los intentos', async () => {
  assert.equal(
    fullJitter(2, 100, 1000, () => 0.5),
    200,
  )
  let now = 0,
    attempts = 0
  const sleeps = []
  const options = {
    maxAttempts: 3,
    deadline: 250,
    now: () => now,
    sleep: async (ms) => {
      sleeps.push(ms)
      now += ms
    },
    random: () => 0.5,
    base: 100,
    cap: 1000,
  }
  await assert.rejects(
    retry(
      async () => {
        attempts++
        now += 100
        throw new Error('transient')
      },
      () => true,
      options,
    ),
    /deadline/,
  )
  assert.equal(attempts, 2)
  assert.deepEqual(sleeps, [50])
  attempts = 0
  await assert.rejects(
    retry(
      async () => {
        attempts++
        throw new Error('declined')
      },
      () => false,
      { ...options, deadline: 1000 },
    ),
    /declined/,
  )
  assert.equal(attempts, 1)
})

test('bulkhead rechaza exceso y libera el cupo también al fallar', async () => {
  const bulkhead = new Bulkhead(1)
  let release
  const first = bulkhead.run(
    () =>
      new Promise((resolve) => {
        release = resolve
      }),
  )
  await assert.rejects(
    bulkhead.run(async () => 1),
    /overloaded/,
  )
  release(1)
  await first
  await assert.rejects(
    bulkhead.run(async () => {
      throw new Error('down')
    }),
    /down/,
  )
  assert.equal(await bulkhead.run(async () => 2), 2)
})

test('lease: nueva entrega invalida ACK del worker antiguo', () => {
  const queue = new LeaseQueue()
  queue.add('j1')
  const first = queue.claim(0, 10)
  assert.equal(queue.claim(1, 10), undefined)
  const second = queue.claim(11, 10)
  assert.equal(queue.ack('j1', first.token), false)
  assert.equal(queue.ack('j1', second.token), true)
})

test('webhook: bytes alterados, firma y timestamp', () => {
  const raw = '{"id":"e1","status":"succeeded"}'
  const signature = sign(raw, 1000, 'local-test-secret')
  assert.equal(verify(raw, 1000, signature, 'local-test-secret', 1100), true)
  assert.equal(verify(raw + ' ', 1000, signature, 'local-test-secret', 1100), false)
  assert.equal(verify(raw, 1000, signature, 'local-test-secret', 2000), false)
  assert.equal(verify(raw, 1000, 'invalid', 'local-test-secret', 1000), false)
})

test('compensación es otra acción; resultado remoto desconocido no se inventa', () => {
  assert.equal(compensate('reserved'), 'released')
  assert.equal(compensate('released'), 'released')
  assert.throws(() => compensate('delivered'))
  assert.equal(reconcile('unknown', 'succeeded'), 'succeeded')
  assert.equal(reconcile('unknown', 'not_found'), 'unknown')
  assert.equal(reconcile('succeeded', 'failed'), 'succeeded')
})

test('secuencias generadas: un terminal confirmado no retrocede', () => {
  let seed = 17
  const actions = ['submit', 'confirm', 'decline', 'uncertain']
  for (let run = 0; run < 100; run++) {
    let state = 'created'
    for (let step = 0; step < 30; step++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
      const previous = state
      try {
        state = transition(state, actions[(seed >>> 16) % actions.length])
      } catch {}
      if (['succeeded', 'failed'].includes(previous)) assert.equal(state, previous)
    }
  }
})

test('operación registrada por allowlist, métricas calculadas con denominador', () => {
  const row = operationLog({
    operation_id: 'o1',
    attempt: 1,
    status: 'unknown',
    authorization: 'secret',
    email: 'private@example.test',
  })
  assert.equal(row.operation_id, 'o1')
  assert.equal(Object.hasOwn(row, 'authorization'), false)
  assert.equal(Object.hasOwn(row, 'email'), false)
  const stats = summarize([10, 20, 30, 40, 100], 1, 0.99)
  assert.equal(stats.p95, 100)
  assert.equal(stats.allowedErrors, 0.05)
  assert.equal(stats.availability, 0.8)
  assert.equal(capacity(100, 0.2), 20)
  assert.throws(() => summarize([], 0, 0.99))
})
