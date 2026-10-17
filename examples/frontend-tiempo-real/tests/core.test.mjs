import test from 'node:test'
import assert from 'node:assert/strict'
import { LatestRequest, optimisticRename } from '../src/state.ts'
import { selectionIncludes, windowRange, acceptEvent } from '../src/data.ts'

test('races: la respuesta antigua no sustituye a la búsqueda más reciente', async () => {
  const request = new LatestRequest()
  let finish
  let visible
  const old = request.run(
    () =>
      new Promise((resolve) => {
        finish = resolve
      }),
    (v) => {
      visible = v
    },
  )
  await request.run(
    async () => 'nuevo',
    (v) => {
      visible = v
    },
  )
  finish('antiguo')
  await old
  assert.equal(visible, 'nuevo')
})

test('cancelación: invalida resultados incluso si el adaptador ignora AbortSignal', async () => {
  const request = new LatestRequest()
  let finish
  let called = false
  const pending = request.run(
    () =>
      new Promise((resolve) => {
        finish = resolve
      }),
    () => {
      called = true
    },
  )
  request.cancel()
  finish('tarde')
  await pending
  assert.equal(called, false)
})

test('optimismo: rollback visual ante rechazo y valor canónico ante éxito', async () => {
  let order = { id: 'o1', name: 'Original', version: 1 }
  const get = () => order
  const set = (value) => {
    order = value
  }
  const failing = optimisticRename(get, set, 'Nuevo', async () => {
    throw new Error('conflict')
  })
  assert.equal(order.name, 'Nuevo')
  await assert.rejects(failing, /conflict/)
  assert.equal(order.name, 'Original')
  await optimisticRename(get, set, 'Nuevo', async () => ({
    id: 'o1',
    name: 'Canónico',
    version: 2,
  }))
  assert.equal(order.name, 'Canónico')
})

test('optimismo: un rollback no pisa una revisión remota más reciente', async () => {
  let order = { id: 'o1', name: 'Original', version: 1 }
  let reject
  const pending = optimisticRename(
    () => order,
    (value) => {
      order = value
    },
    'Nuevo',
    () =>
      new Promise((_, fail) => {
        reject = fail
      }),
  )
  order = { id: 'o1', name: 'Remoto', version: 3 }
  reject(new Error('conflict'))
  await assert.rejects(pending)
  assert.equal(order.name, 'Remoto')
})

test('ventana: 100.000 filas no exigen 100.000 nodos y respeta los extremos', () => {
  assert.deepEqual(windowRange(100000, 0, 320, 32, 2), { start: 0, end: 12 })
  assert.deepEqual(windowRange(100000, 3199990, 320, 32, 2), {
    start: 99997,
    end: 100000,
  })
  assert.deepEqual(windowRange(0, 0, 320, 32, 2), { start: 0, end: 0 })
  assert.throws(() => windowRange(10, 0, 320, 0, 2))
})

test('selección: todas significa el filtro congelado, no cualquier consulta futura', () => {
  const selection = { kind: 'all', filter: 'pending@v1', excluded: new Set(['o2']) }
  assert.equal(selectionIncludes(selection, 'o1', 'pending@v1'), true)
  assert.equal(selectionIncludes(selection, 'o2', 'pending@v1'), false)
  assert.equal(selectionIncludes(selection, 'o1', 'done@v1'), false)
})

test('secuencias: ignora duplicados y exige resync si falta un evento', () => {
  assert.equal(acceptEvent(7, 7), 'duplicate')
  assert.equal(acceptEvent(7, 8), 'apply')
  assert.equal(acceptEvent(7, 10), 'resync')
})
