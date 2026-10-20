import { simulateQuota } from './quota-model.mjs'
const capacity = document.querySelector('#capacity')
const rate = document.querySelector('#rate')
const scenario = document.querySelector('#scenario')
const step = document.querySelector('#step')
const next = document.querySelector('#next')
const format = (value) =>
  new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 }).format(value)
function render() {
  const rows = simulateQuota({
    capacity: Number(capacity.value),
    refillPerSecond: Number(rate.value),
    scenario: scenario.value,
  })
  const visible = rows.slice(0, Number(step.value))
  const events = document.querySelector('#events')
  events.replaceChildren(
    ...visible.map((row) => {
      const li = document.createElement('li')
      li.dataset.allowed = String(row.allowed)
      li.textContent = `${row.at} ms, ${row.tenant}: ${row.allowed ? 'admitida' : 'rechazada'}. Saldo ${format(row.remaining)}.${row.allowed ? '' : ` Retry-After: ${row.retryAfter} s.`}`
      return li
    }),
  )
  const north = visible.filter((row) => row.tenant === 'north')
  const values = [Number(capacity.value), ...north.map((row) => row.remaining)]
  const coordinates = values.map((value, index) => [
    50 + (index * 330) / Math.max(1, north.length),
    170 - (value * 140) / Number(capacity.value),
  ])
  document
    .querySelector('#line')
    .setAttribute('points', coordinates.map((pair) => pair.join(',')).join(' '))
  document.querySelector('#points').replaceChildren(
    ...coordinates.map(([x, y], index) => {
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
      circle.setAttribute('cx', x)
      circle.setAttribute('cy', y)
      circle.setAttribute('r', 4)
      circle.setAttribute(
        'class',
        index === 0 || north[index - 1].allowed ? 'allowed' : 'denied',
      )
      return circle
    }),
  )
  document.querySelector('#capacity-label').textContent = capacity.value
  document.querySelector('#attempts-label').textContent = north.length
  document.querySelector('#progress').textContent =
    `${visible.length} de ${rows.length} decisiones visibles`
  next.disabled = visible.length === rows.length
}
function change() {
  step.value = 0
  render()
}
for (const element of [capacity, rate, scenario])
  element.addEventListener('change', change)
step.addEventListener('input', render)
next.addEventListener('click', () => {
  step.value = Number(step.value) + 1
  render()
})
document.querySelector('#reset').addEventListener('click', () => {
  capacity.value = '4'
  rate.value = '1'
  scenario.value = 'burst'
  change()
})
render()
