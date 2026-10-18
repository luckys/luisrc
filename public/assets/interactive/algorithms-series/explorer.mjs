import { comparisonModel } from './model.mjs'

const byId = (id) => document.getElementById(id)
const number = new Intl.NumberFormat('es-ES')
function update() {
  const n = Number(byId('size').value)
  const q = Number(byId('queries').value)
  const pattern = byId('pattern').value
  const counts = comparisonModel(n, q, pattern)
  byId('size-value').textContent = number.format(n)
  byId('queries-value').textContent = number.format(q)
  byId('linear').textContent = number.format(counts.linearComparisons)
  byId('insertions').textContent = number.format(counts.indexInsertions)
  byId('lookups').textContent = number.format(counts.indexLookups)
  const queryLabel = q === 1 ? 'consulta' : 'consultas'
  const comparisonLabel =
    counts.linearComparisons === 1 ? 'comparación lineal' : 'comparaciones lineales'
  byId('summary').textContent =
    `${number.format(n)} documentos y ${number.format(q)} ${queryLabel}: ${number.format(counts.linearComparisons)} ${comparisonLabel}.`
  const points = Array.from({ length: 20 }, (_, i) => ({
    n: (i + 1) * 1000,
    count: comparisonModel((i + 1) * 1000, q, pattern).linearComparisons,
  }))
  // Escala común de peor caso para los distintos patrones de un mismo q.
  const max = 20000 * q
  const x = (value) => 55 + ((value - 1000) / 19000) * 385
  const y = (value) => 220 - (value / max) * 170
  byId('y-max').textContent = number.format(max / 1000000)
  byId('curve').setAttribute(
    'points',
    points.map((point) => `${x(point.n)},${y(point.count)}`).join(' '),
  )
  byId('point').setAttribute('cx', x(n))
  byId('point').setAttribute('cy', y(counts.linearComparisons))
}
for (const id of ['size', 'queries', 'pattern'])
  byId(id).addEventListener('input', update)
update()
