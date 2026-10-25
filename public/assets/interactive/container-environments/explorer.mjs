const $ = (id) => document.getElementById(id)
const show = (value) => value === undefined ? 'No capturado' : String(value)
const labels = { built: 'Build y cache', fresh_setup: 'Primer setup vacío', persisted_and_cached: 'Escritura y cache',
  api_recreated: 'API recreada', redis_unavailable: 'Redis detenido', postgres_unavailable: 'PostgreSQL detenido',
  postgres_recovered: 'PostgreSQL recuperado', volume_reused: 'Volumen reutilizado', second_fresh_setup: 'Segundo setup vacío', cleanup: 'Limpieza propia' }
try {
  const response = await fetch('replay.json')
  if (!response.ok) throw Error('capture_not_available')
  const data = await response.json()
  $('notice').textContent = `Captura ${data.capturedAt}. ${data.events.length} fases observadas; sin conexión al laboratorio.`
  for (const e of data.events) $('event').add(new Option(`${e.seq}. ${labels[e.id]}`, e.id))
  const textCell = (row, text, tag = 'td') => { const cell = document.createElement(tag); cell.textContent = text; row.append(cell) }
  for (const e of data.events) {
    const row = document.createElement('tr')
    const count = e.facts.rows ?? e.facts.initialRows
    for (const v of [labels[e.id], show(count), show(e.facts.finalRows), 'Observado en fixture local']) textCell(row, v)
    $('rows').tBodies[0].append(row)
  }
  const render = () => {
    const index = $('event').selectedIndex, e = data.events[index], f = e.facts
    $('previous').disabled = index === 0; $('next').disabled = index === data.events.length - 1
    $('summary').textContent = `#${e.seq} · ${e.id} · ${e.at} · ${(e.elapsedMs / 1000).toFixed(2)} s desde inicio del harness`
    const values = [['Filas SQL al observar', f.rows ?? f.initialRows], ['Filas SQL al final de fase', f.finalRows],
      ['HTTP liveness', f.live?.status], ['HTTP readiness', f.ready?.status],
      ['Fuente de lectura fallback', f.fallback?.body?.source], ['UID de API', f.security?.uid],
      ['Cache de instalación reutilizada', f.sourceChangeInstallCached]]
    $('snapshot').tBodies[0].replaceChildren()
    for (const [key, value] of values) { const row = document.createElement('tr'); textCell(row, key, 'th'); textCell(row, show(value)); $('snapshot').tBodies[0].append(row) }
    $('facts').textContent = JSON.stringify(f, null, 2)
    const count = f.rows ?? f.initialRows
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('viewBox', '0 0 340 100'); svg.setAttribute('role', 'img')
    svg.setAttribute('aria-label', count === undefined ? 'Esta fase no capturó un recuento SQL' : `${count} notas al observar la fase; escala de cero a una nota`)
    const ns = svg.namespaceURI
    if (count !== undefined) {
      const rect = document.createElementNS(ns, 'rect')
      for (const [key, value] of Object.entries({ x: 10, y: 10, width: 310 * count, height: 36, fill: '#38bdf8' })) rect.setAttribute(key, String(value))
      svg.append(rect)
    }
    const text = document.createElementNS(ns, 'text'); text.setAttribute('x', '10'); text.setAttribute('y', '78'); text.setAttribute('fill', '#f8fafc'); text.setAttribute('font-size', '16')
    text.textContent = count === undefined ? 'Recuento SQL: no capturado' : `Recuento SQL al observar: ${count} nota(s)`
    svg.append(text); $('graphic').replaceChildren(svg)
  }
  $('event').disabled = false; $('event').addEventListener('change', render)
  for (const [id, delta] of [['previous', -1], ['next', 1]]) $(id).addEventListener('click', () => { $('event').selectedIndex += delta; render() })
  render()
} catch { $('notice').textContent = 'No se pudo leer la captura. Recarga la página o consulta los archivos en GitHub.' }
