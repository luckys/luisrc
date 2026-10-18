// Mismo contrato que classification(): positivo si p >= threshold.
export function evaluate(
  y,
  probabilities,
  threshold,
  falsePositiveCost = 1,
  falseNegativeCost = 10,
) {
  if (y.length !== probabilities.length || !y.length) throw new Error('Pares no vacíos')
  if (
    ![threshold, ...probabilities].every(
      (value) => Number.isFinite(value) && value >= 0 && value <= 1,
    )
  )
    throw new Error('Probabilidad inválida')
  if (
    ![falsePositiveCost, falseNegativeCost].every(
      (value) => Number.isFinite(value) && value >= 0,
    )
  )
    throw new Error('Coste inválido')
  const matrix = [
    [0, 0],
    [0, 0],
  ]
  for (let index = 0; index < y.length; index++) {
    if (y[index] !== 0 && y[index] !== 1) throw new Error('Target binario')
    matrix[y[index]][Number(probabilities[index] >= threshold)]++
  }
  const [[tn, fp], [fn, tp]] = matrix
  return {
    matrix,
    alerts: tp + fp,
    precision: tp + fp ? tp / (tp + fp) : 0,
    recall: tp + fn ? tp / (tp + fn) : 0,
    accuracy: (tp + tn) / y.length,
    cost: fp * falsePositiveCost + fn * falseNegativeCost,
  }
}

if (typeof document !== 'undefined') {
  const response = await fetch('./validation.json')
  if (!response.ok) throw new Error('No se pudieron cargar las predicciones')
  const data = await response.json()
  const threshold = document.querySelector('#threshold')
  const fpCost = document.querySelector('#fp-cost')
  const fnCost = document.querySelector('#fn-cost')
  const graph = document.querySelector('#graph')
  const ns = 'http://www.w3.org/2000/svg'
  function line(points, color) {
    const element = document.createElementNS(ns, 'polyline')
    element.setAttribute(
      'points',
      points.map(([x, y]) => `${50 + 500 * x},${240 - 200 * y}`).join(' '),
    )
    element.setAttribute('fill', 'none')
    element.setAttribute('stroke', color)
    element.setAttribute('stroke-width', '3')
    graph.append(element)
  }
  const candidates = Array.from({ length: 101 }, (_, i) => i / 100)
  const metrics = candidates.map((t) => evaluate(data.y, data.logistic, t))
  line(
    metrics.map((row, i) => [candidates[i], row.precision]),
    '#38bdf8',
  )
  line(
    metrics.map((row, i) => [candidates[i], row.recall]),
    '#fbbf24',
  )
  const marker = document.createElementNS(ns, 'line')
  for (const [key, value] of Object.entries({
    y1: 40,
    y2: 240,
    stroke: '#f8fafc',
    'stroke-width': 2,
    'stroke-dasharray': '4 4',
  }))
    marker.setAttribute(key, String(value))
  graph.append(marker)
  function update() {
    if (
      ![fpCost, fnCost].every(
        (control) => control.value !== '' && control.checkValidity(),
      )
    ) {
      document.querySelector('#summary').textContent =
        'Introduce costes entre 0 y 1000 para calcular el resultado.'
      return
    }
    const t = Number(threshold.value)
    const row = evaluate(
      data.y,
      data.logistic,
      t,
      Number(fpCost.value),
      Number(fnCost.value),
    )
    document.querySelector('#threshold-value').textContent = t
      .toFixed(2)
      .replace('.', ',')
    marker.setAttribute('x1', String(50 + 500 * t))
    marker.setAttribute('x2', String(50 + 500 * t))
    const [[tn, fp], [fn, tp]] = row.matrix
    for (const [key, value] of Object.entries({ tn, fp, fn, tp }))
      document.querySelector(`#${key}`).textContent = value
    document.querySelector('#summary').textContent =
      `${row.alerts} alertas de ${data.y.length}. Precision ${(row.precision * 100).toFixed(2)} %. Recall ${(row.recall * 100).toFixed(2)} %. Coste ficticio ${row.cost}.`
  }
  for (const control of [threshold, fpCost, fnCost])
    control.addEventListener('input', update)
  update()
}
