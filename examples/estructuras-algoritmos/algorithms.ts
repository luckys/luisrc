export type Row = Readonly<{ id: number; title: string }>

export function linearSearch<T extends { readonly id: number }>(
  rows: readonly T[],
  id: number,
): T | undefined {
  for (const row of rows) if (row.id === id) return row
  return undefined
}

export function buildIndex<T extends { readonly id: number }>(
  rows: readonly T[],
): Map<number, T> {
  const index = new Map<number, T>()
  for (const row of rows) {
    if (!Number.isSafeInteger(row.id) || row.id < 0) throw new RangeError('ID inválido')
    if (index.has(row.id)) throw new Error(`ID duplicado: ${row.id}`)
    index.set(row.id, row)
  }
  return index
}

type Link<T> = { value: T; next: Link<T> | undefined }

export class Queue<T> {
  #head: Link<T> | undefined
  #tail: Link<T> | undefined
  #size = 0
  get size(): number {
    return this.#size
  }

  enqueue(value: T): void {
    const node: Link<T> = { value, next: undefined }
    if (this.#tail) this.#tail.next = node
    else this.#head = node
    this.#tail = node
    this.#size++
  }

  dequeue(): T {
    if (!this.#head) throw new RangeError('Cola vacía')
    const { value, next } = this.#head
    this.#head = next
    if (!next) this.#tail = undefined
    this.#size--
    return value
  }
}

export class MinHeap<T> {
  #items: T[] = []
  #compare: (a: T, b: T) => number
  constructor(compare: (a: T, b: T) => number) {
    this.#compare = compare
  }
  get size(): number {
    return this.#items.length
  }

  push(value: T): void {
    this.#items.push(value)
    let child = this.#items.length - 1
    while (child > 0) {
      const parent = Math.floor((child - 1) / 2)
      // Los índices se derivan de la longitud y se comprueban antes de acceder.
      if (this.#compare(this.#items[parent]!, this.#items[child]!) <= 0) break
      this.#swap(parent, child)
      child = parent
    }
  }

  pop(): T | undefined {
    if (!this.size) return undefined
    const first = this.#items[0]!
    const last = this.#items.pop()!
    if (!this.size) return first
    this.#items[0] = last
    let parent = 0
    while (2 * parent + 1 < this.size) {
      let child = 2 * parent + 1
      const right = child + 1
      if (
        right < this.size &&
        this.#compare(this.#items[right]!, this.#items[child]!) < 0
      )
        child = right
      if (this.#compare(this.#items[parent]!, this.#items[child]!) <= 0) break
      this.#swap(parent, child)
      parent = child
    }
    return first
  }

  #swap(a: number, b: number): void {
    const value = this.#items[a]!
    this.#items[a] = this.#items[b]!
    this.#items[b] = value
  }
}

// Precondición: números finitos ordenados de menor a mayor.
export function lowerBound(sorted: readonly number[], target: number): number {
  let low = 0
  let high = sorted.length
  while (low < high) {
    const middle = low + Math.floor((high - low) / 2)
    if (sorted[middle]! < target) low = middle + 1
    else high = middle
  }
  return low
}

export function mergeSort<T>(input: readonly T[], compare: (a: T, b: T) => number): T[] {
  if (input.length < 2) return [...input]
  const middle = Math.floor(input.length / 2)
  const left = mergeSort(input.slice(0, middle), compare)
  const right = mergeSort(input.slice(middle), compare)
  const output: T[] = []
  let i = 0
  let j = 0
  while (i < left.length && j < right.length) {
    // Elegir izquierda en empate conserva el orden relativo original.
    if (compare(left[i]!, right[j]!) <= 0) output.push(left[i++]!)
    else output.push(right[j++]!)
  }
  while (i < left.length) output.push(left[i++]!)
  while (j < right.length) output.push(right[j++]!)
  return output
}

export function shortestPath(
  graph: ReadonlyMap<string, readonly string[]>,
  start: string,
  target: string,
): string[] | undefined {
  if (!graph.has(start) || !graph.has(target)) return undefined
  const frontier = new Queue<string>()
  const previous = new Map<string, string | null>([[start, null]])
  frontier.enqueue(start)
  while (frontier.size) {
    const node = frontier.dequeue()
    if (node === target) {
      const path: string[] = []
      let current: string | null = target
      while (current !== null) {
        path.push(current)
        current = previous.get(current)!
      }
      return path.reverse()
    }
    for (const neighbor of graph.get(node) ?? []) {
      if (!graph.has(neighbor)) throw new RangeError(`Vértice inexistente: ${neighbor}`)
      if (previous.has(neighbor)) continue
      // Marcar al encolar evita añadir varias veces un mismo vértice.
      previous.set(neighbor, node)
      frontier.enqueue(neighbor)
    }
  }
  return undefined
}
