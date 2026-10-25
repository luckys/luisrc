import { WindowIndex, expand, evaluateAlerts, summarizeBudget, classifyCohorts, rules, PERIOD_MINUTES } from './model.mjs'
const data = await (await fetch('scenarios.json')).json()
const $ = (id) => document.getElementById(id)
const select = $('scenario')
select.replaceChildren(...data.scenarios.map((s) => new Option(s.title, s.id)))
select.disabled = false
const ratio = (value) => value === null ? 'sin datos' : value.toFixed(3) + '×'
const number = (value) => value.toLocaleString('es-ES', { maximumFractionDigits: 3 })
function cell(row, value) { const td = document.createElement('td'); td.textContent = String(value); row.append(td) }
function element(name, attrs, text) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', name)
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value)
  if (text) node.textContent = text
  return node
}
function show() {
  const scenario = data.scenarios.find((s) => s.id === select.value)
  const index = new WindowIndex(expand(scenario))
  const target = Number($('target').value)
  const now = PERIOD_MINUTES - 360 + Number($('clock').value)
  $('clock-label').textContent = `${now - PERIOD_MINUTES} min respecto al final`
  const window = index.read(0, PERIOD_MINUTES)
  const budget = window.complete ? summarizeBudget(window.total, window.bad, target) : null
  const alerts = evaluateAlerts(index, now, target)
  const detail = !budget ? 'Cobertura incompleta: no se declara cumplimiento.' : budget.sli === null
    ? 'Cero eventos elegibles conocidos: SLI y cumplimiento no definidos.'
    : `SLI ${number(budget.sli * 100)} %. Malos ${number(budget.bad)}. Permitidos ${number(budget.allowed)}. Restantes ${number(budget.remaining)}.`
  $('summary').textContent = `${scenario.title}. Presupuesto final de 30 días: ${detail} Condición de severidad en el instante elegido: ${alerts.severity}.`
  $('pairs').replaceChildren()
  for (const pair of alerts.pairs) {
    const row = document.createElement('tr')
    for (const value of [pair.id, ratio(pair.longBurn), ratio(pair.shortBurn), pair.state, pair.severity]) cell(row, value)
    $('pairs').append(row)
  }
  const selected = rules.find((rule) => rule.id === $('rule').value)
  const points = Array.from({ length: 361 }, (_, i) => {
    const end = PERIOD_MINUTES - 360 + i
    return evaluateAlerts(index, end, target, [selected]).pairs[0]
  })
  const max = Math.max(selected.threshold * 1.25, 1, ...points.flatMap((p) => [p.longBurn ?? 0, p.shortBurn ?? 0])) * 1.1
  const plotWidth = matchMedia('(max-width:600px)').matches ? 380 : 760
  const right = plotWidth - 25
  const x = (i) => 45 + i / 360 * (right - 45)
  const y = (value) => 235 - value / max * 185
  const svg = $('chart')
  svg.setAttribute('viewBox', `0 0 ${plotWidth} 300`)
  svg.replaceChildren(element('title', { id: 'chart-title' }, `Simulación ${scenario.title}, burn rate ${selected.id}`))
  svg.append(element('path', { d: `M45 45V235H${right}`, stroke: '#94a3b8', fill: 'none' }))
  svg.append(element('path', { d: `M45 ${y(selected.threshold)}H${right}`, stroke: '#fbbf24', 'stroke-dasharray': '5 4' }))
  svg.append(element('path', { d: `M${x(Number($('clock').value))} 45V235`, stroke: '#e5e7eb', 'stroke-dasharray': '3 4' }))
  for (const [key, color] of [['longBurn', '#60a5fa'], ['shortBurn', '#f472b6']]) {
    let segment = []
    const flush = () => { if (segment.length) svg.append(element('polyline', { points: segment.join(' '), fill: 'none', stroke: color, 'stroke-width': 2 })); segment = [] }
    points.forEach((point, i) => { if (point[key] === null) flush(); else segment.push(`${x(i)},${y(point[key])}`) })
    flush()
  }
  for (const [text, tx, ty] of [['0×', 15, 239], [number(max) + '×', 5, 40], ['−360 min', 35, 270], ['final', plotWidth - 60, 270], ['SIMULACIÓN · larga / corta / threshold', 45, 20]]) svg.append(element('text', { x: tx, y: ty, fill: '#e5e7eb', 'font-size': 14 }, text))
}
function showCohorts() {
  const now = Number($('cohort-clock').value)
  const report = classifyCohorts(data.operations, now, 5)
  $('cohort-label').textContent = String(now)
  $('cohort-summary').textContent = `Elegibles ${report.eligible}; buenas ${report.good}; inmaduras ${report.immature}; futuras ${report.future}.`
  $('cohorts').replaceChildren()
  for (const row of report.rows) {
    const tr = document.createElement('tr')
    const operation = data.operations.find((o) => o.id === row.id)
    for (const value of [row.id, operation.createdAt, row.deadline, row.classification]) cell(tr, value)
    $('cohorts').append(tr)
  }
}
for (const id of ['scenario', 'target', 'rule', 'clock']) $(id).addEventListener('input', show)
$('cohort-clock').addEventListener('input', showCohorts)
let resizeFrame = 0
window.addEventListener('resize', () => {
  cancelAnimationFrame(resizeFrame)
  resizeFrame = requestAnimationFrame(show)
})
show(); showCohorts()
