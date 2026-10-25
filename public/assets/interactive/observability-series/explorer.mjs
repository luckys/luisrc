const $ = (id) => document.getElementById(id)
const data = await (await fetch('measurements.json')).json()
const select = $('scenario')
const colors = { 'jobs-web': '#60a5fa', 'jobs-api': '#34d399', 'jobs-worker': '#fbbf24' }
const notes = {
  ok: 'Cinco spans, una traza y resultado ok.',
  fail: 'HTTP 202 aceptó el job. El worker terminó con error y su span tiene status ERROR.',
  broken: 'El carrier se perdió: el worker abrió otra traza sin parent ni link.',
  link: 'El worker abrió una traza nueva y enlazó el span del productor.',
  unsampled: 'Cero spans exportados. Dos logs y una observación de duración siguen existiendo.',
}
select.replaceChildren(...data.cases.map((entry) => new Option(entry.scenario, entry.scenario)))
select.disabled = false
function cell(row, value, code = false) {
  const td = document.createElement('td')
  const content = document.createElement(code ? 'code' : 'span')
  content.textContent = value
  td.append(content); row.append(td)
}
function svgElement(name, attrs, text) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', name)
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value)
  if (text) node.textContent = text
  return node
}
function show(scenario, highlight = '') {
  select.value = scenario
  const entry = data.cases.find((entry) => entry.scenario === scenario)
  $('summary').textContent = `${entry.job.operationId} · ${notes[scenario]}`
  $('spans').replaceChildren()
  const depth = (span) => {
    const parent = entry.spans.find((candidate) => candidate.spanId === span.parentSpanId)
    return parent ? depth(parent) + 1 : 0
  }
  const ordered = entry.spans.toSorted((a, b) => a.startMs - b.startMs || depth(a) - depth(b))
  for (const span of ordered) {
    const row = document.createElement('tr')
    if (span.spanId === highlight) row.className = 'selected'
    cell(row, `${span.name} / ${span.service}`)
    cell(row, span.traceId, true)
    cell(row, span.parentSpanId ?? (span.links.length ? `link: ${span.links[0].spanId}` : 'root'), true)
    cell(row, `${span.durationMs.toFixed(3)} ms / ${span.status.code === 2 ? 'ERROR' : 'UNSET'}`)
    $('spans').append(row)
  }
  $('logs').replaceChildren()
  for (const log of entry.logs) {
    const row = document.createElement('tr')
    cell(row, log.event); cell(row, `${log.operation_id} / ${log.request_id}`)
    cell(row, `${log.trace_id} / ${log.span_id}`, true); cell(row, log.result)
    $('logs').append(row)
  }
  const timeline = $('timeline')
  timeline.replaceChildren(svgElement('title', { id: 'timeline-title' }, `Timeline observado del escenario ${scenario}`))
  if (!ordered.length) {
    timeline.append(svgElement('text', { x: 20, y: 80, fill: '#f8fafc' }, 'No se exportaron spans: no significa que no hubiera trabajo.'))
    return
  }
  const start = Math.min(...ordered.map((span) => span.startMs))
  const total = Math.max(...ordered.map((span) => span.startMs + span.durationMs)) - start || 1
  for (const [i, span] of ordered.entries()) {
    const y = 35 + i * 43
    timeline.append(svgElement('text', { x: 5, y, fill: colors[span.service] }, span.name))
    timeline.append(svgElement('rect', { x: 190 + (span.startMs - start) / total * 500, y: y - 13,
      width: Math.max(2, span.durationMs / total * 500), height: 18, rx: 3, fill: colors[span.service],
      stroke: span.spanId === highlight ? '#fff' : 'none', 'stroke-width': 3 }))
  }
}
select.addEventListener('change', () => { show(select.value); $('selection').textContent = 'Selecciona un exemplar para localizar su span.' })
$('metric-summary').textContent = data.metrics.histogram.map((point) => `${point.attributes.result}: ${point.value.count} ${point.value.count === 1 ? 'job' : 'jobs'}`).join(' · ')
for (const point of data.metrics.histogram) {
  const row = document.createElement('tr')
  cell(row, point.attributes.result)
  for (const count of point.value.buckets.counts) cell(row, String(count))
  cell(row, `${point.value.count} / ${point.value.sum.toFixed(6)} s`)
  $('histogram').append(row)
}
for (const exemplar of data.metrics.exemplars) {
  const button = document.createElement('button')
  const upper = data.metrics.histogram[0].value.buckets.boundaries[exemplar.bucket] ?? '+Inf'
  button.textContent = `${exemplar.result}, bucket ≤ ${upper} s: ${(exemplar.value * 1000).toFixed(3)} ms`
  button.addEventListener('click', () => {
    const entry = data.cases.find((entry) => entry.spans.some((span) => span.traceId === exemplar.traceId && span.spanId === exemplar.spanId))
    show(entry.scenario, exemplar.spanId)
    $('selection').textContent = `Exemplar localizado en ${entry.job.operationId}, span ${exemplar.spanId}.`
  })
  $('exemplars').append(button)
}
show('ok')
