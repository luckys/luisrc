import test from 'node:test'
import assert from 'node:assert/strict'
import {
  insertionSort,
  selectionSort,
  bubbleSort,
  quickSort,
  heapSort,
  countingSort,
  treeInsert,
  treeHas,
  depthFirst,
  dijkstra,
} from '../focused.ts'

const numeric = (a, b) => a - b
const cases = [[], [4], [2, 1], [1, 2, 3], [3, 2, 1], [2, 2, 1, 3, 1], [-3, 5, 0, -3]]
for (const sort of [insertionSort, selectionSort, bubbleSort, quickSort, heapSort]) {
  test(`${sort.name}: orden, multiplicidades y entrada intacta`, () => {
    for (const input of cases) {
      const copy = [...input]
      assert.deepEqual(sort(input, numeric), [...input].sort(numeric))
      assert.deepEqual(input, copy)
    }
    // Enumeración exhaustiva pequeña: no depende de una semilla ni de tiempos.
    for (let code = 0; code < 243; code++) {
      let value = code
      const input = Array.from({ length: 5 }, () => {
        const digit = value % 3
        value = Math.floor(value / 3)
        return digit - 1
      })
      assert.deepEqual(sort(input, numeric), [...input].sort(numeric))
    }
  })
}

test('insertion, bubble y quick de tres arrays conservan los empates', () => {
  const rows = [
    { key: 2, id: 'a' },
    { key: 1, id: 'b' },
    { key: 2, id: 'c' },
    { key: 1, id: 'd' },
  ]
  for (const sort of [insertionSort, bubbleSort, quickSort])
    assert.deepEqual(
      sort(rows, (a, b) => a.key - b.key).map((x) => x.id),
      ['b', 'd', 'a', 'c'],
    )
})

test('selection y heap no prometen estabilidad', () => {
  const rows = [
    { key: 2, id: 'a' },
    { key: 2, id: 'b' },
    { key: 1, id: 'c' },
  ]
  for (const sort of [selectionSort, heapSort])
    assert.notDeepEqual(
      sort(rows, (a, b) => a.key - b.key)
        .filter((x) => x.key === 2)
        .map((x) => x.id),
      ['a', 'b'],
    )
})

test('counting sort: rango acotado, frecuencias y rechazos', () => {
  assert.deepEqual(countingSort([3, 0, 3, 1], 3), [0, 1, 3, 3])
  assert.deepEqual(countingSort([], 0), [])
  for (const input of [[-1], [4], [1.5], [NaN]])
    assert.throws(() => countingSort(input, 3), RangeError)
  for (const max of [-1, 1.5, 100001, Infinity])
    assert.throws(() => countingSort([], max), RangeError)
})

test('BST: inserción sin duplicados, búsqueda y árbol degenerado', () => {
  let root
  for (const key of [4, 2, 6, 1, 3, 4]) root = treeInsert(root, key)
  for (const key of [1, 2, 3, 4, 6]) assert.equal(treeHas(root, key), true)
  assert.equal(treeHas(root, 5), false)
  assert.equal(treeHas(undefined, 1), false)
  assert.equal(root.left.right.key, 3)
  assert.throws(() => treeInsert(root, NaN), RangeError)
  let chain
  for (const key of [1, 2, 3, 4]) chain = treeInsert(chain, key)
  assert.equal(chain.right.right.right.key, 4)
})

test('DFS: ciclos, duplicados, desconectado y validación del subgrafo visitado', () => {
  const graph = new Map([
    ['a', ['b', 'c']],
    ['b', ['a', 'd']],
    ['c', ['d']],
    ['d', []],
    ['z', []],
  ])
  assert.deepEqual(depthFirst(graph, 'a'), ['a', 'b', 'd', 'c'])
  assert.deepEqual(depthFirst(graph, 'z'), ['z'])
  assert.deepEqual(depthFirst(graph, 'missing'), [])
  assert.throws(() => depthFirst(new Map([['a', ['missing']]]), 'a'), RangeError)
})

test('Dijkstra: más aristas pueden dar menos coste; descarta entradas obsoletas', () => {
  const graph = new Map([
    [
      'a',
      [
        { to: 'b', weight: 10 },
        { to: 'c', weight: 1 },
      ],
    ],
    ['c', [{ to: 'b', weight: 1 }]],
    ['b', [{ to: 'd', weight: 1 }]],
    ['d', []],
    ['z', []],
  ])
  assert.deepEqual(dijkstra(graph, 'a', 'd'), { distance: 3, path: ['a', 'c', 'b', 'd'] })
  assert.deepEqual(dijkstra(graph, 'a', 'a'), { distance: 0, path: ['a'] })
  assert.equal(dijkstra(graph, 'a', 'z'), undefined)
  assert.equal(dijkstra(graph, 'absent', 'd'), undefined)
  const reads = new Map()
  const get = graph.get.bind(graph)
  graph.get = (key) => {
    reads.set(key, (reads.get(key) ?? 0) + 1)
    return get(key)
  }
  assert.equal(dijkstra(graph, 'a', 'z'), undefined)
  assert.equal(reads.get('b'), 1, 'La entrada B=10 obsoleta no debe expandir B otra vez')
})

test('Dijkstra: cero, empates y fronteras inválidas incluso fuera del recorrido', () => {
  assert.deepEqual(
    dijkstra(
      new Map([
        ['a', [{ to: 'b', weight: 0 }]],
        ['b', []],
      ]),
      'a',
      'b',
    ),
    { distance: 0, path: ['a', 'b'] },
  )
  for (const weight of [-1, NaN, Infinity, 1.5])
    assert.throws(
      () =>
        dijkstra(
          new Map([
            ['a', []],
            ['z', [{ to: 'a', weight }]],
          ]),
          'a',
          'a',
        ),
      RangeError,
    )
  assert.throws(
    () => dijkstra(new Map([['a', [{ to: 'b', weight: 1 }]]]), 'a', 'a'),
    RangeError,
  )
  const max = Number.MAX_SAFE_INTEGER
  assert.throws(
    () =>
      dijkstra(
        new Map([
          ['a', [{ to: 'b', weight: max }]],
          ['b', [{ to: 'c', weight: 1 }]],
          ['c', []],
        ]),
        'a',
        'c',
      ),
    RangeError,
  )
})
