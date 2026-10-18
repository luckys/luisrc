const patterns = ['first', 'last', 'miss', 'mixed']

function validate(n, q, pattern) {
  if (
    !Number.isInteger(n) ||
    n < 1 ||
    n > 100000 ||
    !Number.isInteger(q) ||
    q < 1 ||
    q > 2000 ||
    !patterns.includes(pattern)
  )
    throw new RangeError('Carga fuera de los límites del laboratorio')
}

function queryAt(n, i, pattern) {
  if (pattern === 'first') return 0
  if (pattern === 'last') return n - 1
  if (pattern === 'miss') return -1
  // Determinista: una ausencia de cada dos consultas; el resto recorre posiciones.
  return i % 2 ? -1 : (i * 7919 + 17) % n
}

export function workload(n, q, pattern) {
  validate(n, q, pattern)
  return {
    rows: Array.from({ length: n }, (_, id) => ({ id, title: `Documento ${id}` })),
    queries: Array.from({ length: q }, (_, i) => queryAt(n, i, pattern)),
  }
}

export function comparisonModel(n, q, pattern) {
  validate(n, q, pattern)
  let linearComparisons = 0
  for (let i = 0; i < q; i++) {
    const id = queryAt(n, i, pattern)
    linearComparisons += id === -1 ? n : id + 1
  }
  return { linearComparisons, indexInsertions: n, indexLookups: q }
}
