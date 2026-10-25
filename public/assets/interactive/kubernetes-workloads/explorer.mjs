import { chartSeries } from './chart.mjs'
const byId = (id) => document.getElementById(id), value = (v) => v === undefined || v === null ? 'No capturado' : String(v)
const names = ['Clúster preparado', 'Dos images importadas', 'Catálogo preparado', 'Pod sustituido', 'Rollout a v2', 'Undo a v1', 'DNS y Service', 'Routing de Ingress', 'Arranque protegido', 'Arranque sin startup', 'Readiness retira tráfico', 'Readiness recuperada', 'Liveness reinicia container', 'Archivo nuevo y env antiguo', 'Env actualizado tras rollout', 'Permisos RBAC y Secret', 'Request sin sitio', 'Límite de memoria y OOM', 'Métricas HPA disponibles', 'HPA aumenta réplicas', 'HPA reduce réplicas', 'Namespace eliminado', 'Clúster eliminado']
let data, eventIndex = 0, sampleIndex = 0
const row = (cells) => { const tr = document.createElement('tr'); for (const text of cells) { const td = document.createElement('td'); td.textContent = String(text); tr.append(td) } return tr }
function showEvent() {
  const event = data.events[eventIndex], f = event.facts, pod = f.pod ?? f.after
  byId('event').value = String(eventIndex); byId('previous').disabled = eventIndex === 0; byId('next').disabled = eventIndex === data.events.length - 1
  byId('phase-title').textContent = names[eventIndex]; byId('summary').textContent = '#' + event.seq + ' · ' + event.id + ' · ' + event.at
  byId('snapshot').replaceChildren(...[['HTTP catálogo', f.http?.status], ['Mensaje', f.http?.body.message], ['Versión devuelta', f.http?.body.version], ['Pod preparado', pod?.ready], ['Reinicios', pod?.restarts], ['Endpoints preparados', f.endpoints?.filter((e) => e.ready === true).length], ['Réplicas deseadas HPA', f.sample?.desired], ['Réplicas preparadas HPA', f.sample?.ready]].map(([label, v]) => row([label, value(v)])))
  byId('facts').textContent = JSON.stringify(f, null, 2)
}
function svgElement(name, attrs) { const element = document.createElementNS('http://www.w3.org/2000/svg', name); for (const [key, v] of Object.entries(attrs)) element.setAttribute(key, String(v)); return element }
function showSample() {
  const s = data.samples[sampleIndex]
  // Keep a common time axis across selections; otherwise early points would jump.
  const full = chartSeries(data.samples), prefix = data.samples.slice(0, sampleIndex + 1)
  const points = (key) => prefix.filter((p) => Number.isFinite(p[key]) && (key !== 'desired' || Number.isFinite(p.cpuPercent))).map((p) => full.point(p, p[key]).map((n) => n.toFixed(2)).join(',')).join(' ')
  byId('sample').value = String(sampleIndex); byId('sample-previous').disabled = sampleIndex === 0; byId('sample-next').disabled = sampleIndex === data.samples.length - 1
  byId('sample-summary').textContent = 'Muestra ' + (sampleIndex + 1) + '/' + data.samples.length + ' · ' + s.phase + ' · ' + s.at
  byId('sample-values').replaceChildren(...[['Fase de carga', s.phase], ['CPU (% request)', s.cpuPercent], ['Target (%)', s.target], [s.cpuPercent === null ? 'Deseadas HPA (sin métrica válida)' : 'Deseadas HPA', s.desired], ['Actuales HPA', s.current], ['Preparadas Deployment', s.ready]].map(([label, v]) => row([label, value(v)])))
  const svg = svgElement('svg', { viewBox: '0 0 380 300', role: 'img', 'aria-label': 'Réplicas deseadas azules y preparadas violetas hasta la muestra seleccionada, escala común de cero a tres' })
  for (const n of [0, 1, 2, 3]) { svg.append(svgElement('line', { x1: 40, x2: 350, y1: 245 - 60 * n, y2: 245 - 60 * n, stroke: '#475569' })); const t = svgElement('text', { x: 18, y: 250 - 60 * n, fill: '#f1f5f9', 'font-size': 14 }); t.textContent = String(n); svg.append(t) }
  for (const [key, color] of [['desired', '#38bdf8'], ['ready', '#c4b5fd']]) {
    svg.append(svgElement('polyline', { points: points(key), fill: 'none', stroke: color, 'stroke-width': key === 'desired' ? 3 : 2, 'data-series': key }))
    if (Number.isFinite(s[key]) && (key !== 'desired' || Number.isFinite(s.cpuPercent))) { const [cx, cy] = full.point(s, s[key]); svg.append(svgElement('circle', { cx, cy, r: 5, fill: color, 'data-current': key })) }
  }
  const label = svgElement('text', { x: 40, y: 280, fill: '#cbd5e1', 'font-size': 13 }); label.textContent = 'Azul: deseadas · Violeta: preparadas'; svg.append(label)
  byId('chart').replaceChildren(svg)
}
try {
  const response = await fetch('replay.json'); if (!response.ok) throw Error('missing_report'); data = await response.json()
  byId('capture').textContent = 'Captura ' + data.capturedAt + ' · ' + data.events.length + ' fases locales.'
  for (const [i, event] of data.events.entries()) { const option = document.createElement('option'); option.value = String(i); option.textContent = '#' + event.seq + ' · ' + names[i]; byId('event').append(option) }
  byId('event').disabled = false; showEvent()
  byId('sample').max = String(data.samples.length - 1); byId('sample').disabled = false; showSample()
  byId('event').addEventListener('change', () => { eventIndex = Number(byId('event').value); showEvent() })
  byId('previous').addEventListener('click', () => { if (eventIndex > 0) { eventIndex--; showEvent() } }); byId('next').addEventListener('click', () => { if (eventIndex < data.events.length - 1) { eventIndex++; showEvent() } })
  byId('sample').addEventListener('input', () => { sampleIndex = Number(byId('sample').value); showSample() })
  byId('sample-previous').addEventListener('click', () => { if (sampleIndex > 0) { sampleIndex--; showSample() } }); byId('sample-next').addEventListener('click', () => { if (sampleIndex < data.samples.length - 1) { sampleIndex++; showSample() } })
} catch { byId('error').hidden = false; byId('error').textContent = 'No se pudo cargar la captura. No hay observaciones disponibles.' }
