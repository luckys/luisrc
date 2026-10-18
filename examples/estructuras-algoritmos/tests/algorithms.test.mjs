import test from 'node:test'
import assert from 'node:assert/strict'
import {
  linearSearch,
  buildIndex,
  Queue,
  MinHeap,
  lowerBound,
  mergeSort,
  shortestPath,
} from '../algorithms.ts'
import { workload, comparisonModel } from '../model.mjs'

test('búsqueda e índice conservan ausencias, orden y referencias', () => {
  const rows = [
    { id: 4, title: 'A' },
    { id: 9, title: 'B' },
  ]
  const index = buildIndex(rows)
  for (const id of [4, 9, 7]) assert.equal(linearSearch(rows, id), index.get(id))
  assert.equal(linearSearch([], 1), undefined)
  assert.equal(buildIndex([]).size, 0)
  assert.throws(() => buildIndex([...rows, rows[0]]), /duplicado/)
  for (const id of [NaN, Infinity, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])
    assert.throws(() => buildIndex([{ id }]), /inválido/)
})

test('cola FIFO reutilizable, incluida una carga undefined', () => {
  const queue = new Queue()
  assert.throws(() => queue.dequeue(), /vacía/)
  for (const item of [1, undefined, 3]) queue.enqueue(item)
  assert.equal(queue.size, 3)
  assert.equal(queue.dequeue(), 1)
  assert.equal(queue.dequeue(), undefined)
  assert.equal(queue.dequeue(), 3)
  assert.equal(queue.size, 0)
  queue.enqueue(4)
  assert.equal(queue.dequeue(), 4)
})

test('un índice obsoleto debe reconstruirse al sustituir el catálogo', () => {
  const initial = [
    { id: 1, title: 'A' },
    { id: 2, title: 'B' },
  ]
  const stale = buildIndex(initial)
  const replacement = [initial[1]]
  assert.notEqual(stale.get(1), linearSearch(replacement, 1))
  assert.equal(buildIndex(replacement).get(1), linearSearch(replacement, 1))
})

test('heap devuelve prioridades en orden, sin ordenar todo al insertar', () => {
  const heap = new MinHeap((a, b) => a - b)
  assert.equal(heap.pop(), undefined)
  for (const value of [7, 2, 9, 2, -1, 0]) heap.push(value)
  assert.equal(heap.size, 6)
  assert.deepEqual(
    Array.from({ length: 6 }, () => heap.pop()),
    [-1, 0, 2, 2, 7, 9],
  )
  assert.equal(heap.size, 0)
  heap.push(8)
  assert.equal(heap.pop(), 8)
})

test('heap conserva todas las entradas tras mezclar inserciones y extracciones', () => {
  const heap = new MinHeap((a, b) => a.priority - b.priority || a.sequence - b.sequence)
  const reference = []
  const compare = (a, b) => a.priority - b.priority || a.sequence - b.sequence
  for (let sequence = 0; sequence < 500; sequence++) {
    const entry = { priority: (sequence * 17) % 41, sequence }
    heap.push(entry)
    reference.push(entry)
    if (sequence % 3 === 0) {
      reference.sort(compare)
      assert.equal(heap.pop(), reference.shift())
    }
  }
  reference.sort(compare)
  assert.deepEqual(
    Array.from({ length: heap.size }, () => heap.pop()),
    reference,
  )
})

test('búsqueda binaria devuelve primera posición de inserción, también en bordes', () => {
  for (let size = 0; size < 100; size++) {
    const rows = Array.from({ length: size }, (_, i) => Math.floor(i / 2))
    for (let target = -1; target <= size; target++) {
      const expected = rows.findIndex((value) => value >= target)
      assert.equal(lowerBound(rows, target), expected === -1 ? size : expected)
    }
  }
})

test('contraejemplo documentado: no aplicar búsqueda binaria sobre datos sin ordenar', () => {
  assert.equal(lowerBound([3, 1, 2], 3), 3)
  assert.equal([3, 1, 2].indexOf(3), 0)
})

test('merge sort no muta y conserva orden de elementos equivalentes', () => {
  const input = [
    { key: 2, id: 'a' },
    { key: 1, id: 'b' },
    { key: 2, id: 'c' },
  ]
  assert.deepEqual(
    mergeSort(input, (a, b) => a.key - b.key).map((row) => row.id),
    ['b', 'a', 'c'],
  )
  assert.deepEqual(
    input.map((row) => row.id),
    ['a', 'b', 'c'],
  )
  assert.deepEqual(
    mergeSort([], (a, b) => a - b),
    [],
  )
  for (let size = 1; size < 100; size++) {
    const numbers = Array.from({ length: size }, (_, i) => (i * 17) % 31)
    assert.deepEqual(
      mergeSort(numbers, (a, b) => a - b),
      [...numbers].sort((a, b) => a - b),
    )
  }
})

test('BFS trata ciclos, nodos aislados y caminos mínimos en número de aristas', () => {
  const graph = new Map([
    ['a', ['b', 'c']],
    ['b', ['a', 'd']],
    ['c', ['d']],
    ['d', []],
    ['z', []],
  ])
  assert.deepEqual(shortestPath(graph, 'a', 'd'), ['a', 'b', 'd'])
  assert.deepEqual(shortestPath(graph, 'a', 'a'), ['a'])
  assert.equal(shortestPath(graph, 'a', 'z'), undefined)
  assert.equal(shortestPath(graph, 'absent', 'a'), undefined)
  assert.throws(
    () =>
      shortestPath(
        new Map([
          ['a', ['missing']],
          ['z', []],
        ]),
        'a',
        'z',
      ),
    /inexistente/,
  )
})

test('BFS puede escoger otra ruta, pero conserva el mínimo de aristas', () => {
  const graph = new Map([
    ['a', ['c', 'b']],
    ['b', ['a', 'd']],
    ['c', ['d']],
    ['d', []],
  ])
  assert.deepEqual(shortestPath(graph, 'a', 'd'), ['a', 'c', 'd'])
})

test('modelo cuenta comparaciones reales; no equipara un acceso Map con nanosegundos', () => {
  assert.deepEqual(comparisonModel(10, 3, 'first'), {
    linearComparisons: 3,
    indexInsertions: 10,
    indexLookups: 3,
  })
  assert.equal(comparisonModel(10, 3, 'last').linearComparisons, 30)
  assert.equal(comparisonModel(10, 3, 'miss').linearComparisons, 30)
  for (const pattern of ['first', 'last', 'miss', 'mixed']) {
    const { rows, queries } = workload(100, 20, pattern)
    let comparisons = 0
    for (const id of queries) {
      for (const row of rows) {
        comparisons++
        if (row.id === id) break
      }
    }
    assert.equal(comparisonModel(100, 20, pattern).linearComparisons, comparisons)
    const index = buildIndex(rows)
    assert.deepEqual(
      queries.map((id) => linearSearch(rows, id)),
      queries.map((id) => index.get(id)),
    )
  }
  assert.throws(() => workload(0, 10, 'first'), RangeError)
  assert.throws(() => workload(10, 2, 'unknown'), RangeError)
})
