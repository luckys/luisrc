import { MinHeap } from './algorithms.ts'

export function insertionSort<T>(
  input: readonly T[],
  compare: (a: T, b: T) => number,
): T[] {
  const items = [...input]
  for (let i = 1; i < items.length; i++) {
    const value = items[i]!
    let j = i
    while (j > 0 && compare(items[j - 1]!, value) > 0) {
      items[j] = items[j - 1]!
      j--
    }
    items[j] = value
  }
  return items
}

export function selectionSort<T>(
  input: readonly T[],
  compare: (a: T, b: T) => number,
): T[] {
  const items = [...input]
  for (let i = 0; i < items.length - 1; i++) {
    let smallest = i
    for (let j = i + 1; j < items.length; j++)
      if (compare(items[j]!, items[smallest]!) < 0) smallest = j
    const value = items[i]!
    items[i] = items[smallest]!
    items[smallest] = value
  }
  return items
}

export function bubbleSort<T>(input: readonly T[], compare: (a: T, b: T) => number): T[] {
  const items = [...input]
  for (let end = items.length - 1; end > 0; end--) {
    let changed = false
    for (let j = 0; j < end; j++) {
      if (compare(items[j]!, items[j + 1]!) <= 0) continue
      const value = items[j]!
      items[j] = items[j + 1]!
      items[j + 1] = value
      changed = true
    }
    if (!changed) break
  }
  return items
}

export function quickSort<T>(input: readonly T[], compare: (a: T, b: T) => number): T[] {
  if (input.length < 2) return [...input]
  const pivot = input[Math.floor(input.length / 2)]!
  const less: T[] = [],
    equal: T[] = [],
    greater: T[] = []
  for (const value of input) {
    const order = compare(value, pivot)
    if (order < 0) less.push(value)
    else if (order > 0) greater.push(value)
    else equal.push(value)
  }
  return [...quickSort(less, compare), ...equal, ...quickSort(greater, compare)]
}

export function heapSort<T>(input: readonly T[], compare: (a: T, b: T) => number): T[] {
  const items = [...input]
  function siftDown(root: number, length: number): void {
    while (2 * root + 1 < length) {
      let child = 2 * root + 1
      if (child + 1 < length && compare(items[child]!, items[child + 1]!) < 0) child++
      if (compare(items[root]!, items[child]!) >= 0) return
      const value = items[root]!
      items[root] = items[child]!
      items[child] = value
      root = child
    }
  }
  for (let root = Math.floor(items.length / 2) - 1; root >= 0; root--)
    siftDown(root, items.length)
  for (let end = items.length - 1; end > 0; end--) {
    const maximum = items[0]!
    items[0] = items[end]!
    items[end] = maximum
    siftDown(0, end)
  }
  return items
}

export function countingSort(input: readonly number[], max: number): number[] {
  if (!Number.isInteger(max) || max < 0 || max > 100000)
    throw new RangeError('Rango no admitido')
  const counts = new Array<number>(max + 1).fill(0)
  for (const value of input) {
    if (!Number.isInteger(value) || value < 0 || value > max)
      throw new RangeError('Clave fuera de rango')
    counts[value] = counts[value]! + 1
  }
  const output: number[] = []
  for (let value = 0; value <= max; value++)
    for (let count = 0; count < counts[value]!; count++) output.push(value)
  return output
}

export type TreeNode = {
  key: number
  left: TreeNode | undefined
  right: TreeNode | undefined
}

export function treeInsert(root: TreeNode | undefined, key: number): TreeNode {
  if (!Number.isFinite(key)) throw new RangeError('Clave no finita')
  const node: TreeNode = { key, left: undefined, right: undefined }
  if (!root) return node
  let current = root
  while (true) {
    if (key === current.key) return root
    const side = key < current.key ? 'left' : 'right'
    const child = current[side]
    if (!child) {
      current[side] = node
      return root
    }
    current = child
  }
}

export function treeHas(root: TreeNode | undefined, key: number): boolean {
  let current = root
  while (current) {
    if (key === current.key) return true
    current = key < current.key ? current.left : current.right
  }
  return false
}

export function depthFirst(
  graph: ReadonlyMap<string, readonly string[]>,
  start: string,
): string[] {
  if (!graph.has(start)) return []
  const stack = [start]
  const seen = new Set<string>()
  const order: string[] = []
  while (stack.length) {
    const node = stack.pop()!
    if (seen.has(node)) continue
    seen.add(node)
    order.push(node)
    const neighbors = graph.get(node)!
    // Apilar al revés hace que el primer vecino de la lista se visite antes.
    for (let i = neighbors.length - 1; i >= 0; i--) {
      const neighbor = neighbors[i]!
      if (!graph.has(neighbor)) throw new RangeError('Vértice inexistente')
      if (!seen.has(neighbor)) stack.push(neighbor)
    }
  }
  return order
}

export type Edge = Readonly<{ to: string; weight: number }>

export function dijkstra(
  graph: ReadonlyMap<string, readonly Edge[]>,
  start: string,
  target: string,
): { distance: number; path: string[] } | undefined {
  // Validamos todo el grafo antes de poder terminar temprano en el destino.
  for (const edges of graph.values())
    for (const edge of edges)
      if (!graph.has(edge.to) || !Number.isSafeInteger(edge.weight) || edge.weight < 0)
        throw new RangeError('Arista inválida')
  if (!graph.has(start) || !graph.has(target)) return undefined
  const distances = new Map<string, number>([[start, 0]])
  const previous = new Map<string, string>()
  const frontier = new MinHeap<{ node: string; distance: number }>(
    (a, b) => a.distance - b.distance,
  )
  frontier.push({ node: start, distance: 0 })
  while (frontier.size) {
    const current = frontier.pop()!
    if (current.distance !== distances.get(current.node)) continue
    if (current.node === target) {
      const path = [target]
      while (path[path.length - 1] !== start)
        path.push(previous.get(path[path.length - 1]!)!)
      return { distance: current.distance, path: path.reverse() }
    }
    for (const edge of graph.get(current.node)!) {
      const candidate = current.distance + edge.weight
      if (!Number.isSafeInteger(candidate))
        throw new RangeError('Distancia fuera de rango')
      if (candidate >= (distances.get(edge.to) ?? Infinity)) continue
      distances.set(edge.to, candidate)
      previous.set(edge.to, current.node)
      frontier.push({ node: edge.to, distance: candidate })
    }
  }
  return undefined
}
