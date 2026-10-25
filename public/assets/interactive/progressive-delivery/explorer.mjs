const $ = (id) => document.getElementById(id)
const show = (v) => v === undefined ? 'No capturado' : String(v)
const labels = { pipeline_completed: 'Pipeline local', baseline_schema: 'Base estable', schema_expanded: 'Expand y escritor antiguo',
  candidate_deployed_dark: 'Candidato sin tráfico', smoke_flag_off: 'Smoke con flag off', rolling_first_slot: 'Rolling: versiones mixtas',
  rolling_all_slots: 'Rolling: ambos reemplazados', blue_green_switch: 'Blue a green', blue_restored: 'Vuelta a blue',
  canary_exposed: 'Canary 10 % sintético', canary_rollback: 'Retirada del canary', forced_negative_release: 'Prueba negativa forzada',
  flag_disabled: 'Flag apagada, misma image', candidate_write: 'Escritura de v2', image_rollback: 'Image v1 restaurada',
  unsafe_contract_rejected: 'Contract incompatible, revertido', rollback_integrity: 'Integridad y escritura posterior', cleanup: 'Recursos propios cerrados' }
const cell = (row, value, tag = 'td') => { const e = document.createElement(tag); e.textContent = show(value); row.append(e) }
try {
  const response = await fetch('replay.json'); if (!response.ok) throw Error('capture_not_available')
  const data = await response.json()
  $('notice').textContent = `Captura ${data.capturedAt}. ${data.events.length} fases observadas, sin conexión al laboratorio.`
  for (const e of data.events) $('event').add(new Option(`${e.seq}. ${labels[e.id]}`, e.id))
  const renderEvent = () => {
    const index = $('event').selectedIndex, e = data.events[index], f = e.facts, route = f.route?.route
    $('previous').disabled = index === 0; $('next').disabled = index === data.events.length - 1
    $('summary').textContent = `#${e.seq} · ${e.id} · ${e.at} · ${(e.elapsedMs / 1000).toFixed(2)} s desde inicio del harness`
    $('facts').textContent = JSON.stringify(f, null, 2)
    const rows = Array.isArray(f.afterRows) ? f.afterRows.length : Array.isArray(f.rows) ? f.rows.length : f.rows
    const values = [['Ruta principal', route?.slots.join(', ')], ['Canary hacia green (%)', route?.canaryPercent],
      ['Flag activa', route?.featureEnabled], ['Revisión de ruta', f.route?.revision], ['Smoke correcto', f.smoke?.ok],
      ['Filas SQL capturadas', rows], ['Prueba negativa forzada', f.negativeFixture]]
    $('snapshot').tBodies[0].replaceChildren()
    for (const [key, value] of values) { const row = document.createElement('tr'); cell(row, key, 'th'); cell(row, value); $('snapshot').tBodies[0].append(row) }
  }
  $('event').disabled = false; $('event').addEventListener('change', renderEvent)
  for (const [id, delta] of [['previous', -1], ['next', 1]]) $(id).addEventListener('click', () => { $('event').selectedIndex += delta; renderEvent() })
  const samples = data.events.find((e) => e.id === 'canary_exposed').facts.samples
  let page = 0; const pageSize = 12
  const renderSamples = () => {
    const cohort = $('cohort').value
    const rows = samples.filter((s) => cohort === 'all' || (s.slot === 'green') === (cohort === 'candidate'))
    const http = rows.filter((s) => s.status === 200).length, good = rows.filter((s) => !s.bad).length
    $('sample-summary').textContent = `${rows.length} respuestas · ${http} HTTP 200 · ${good} precios correctos · ${rows.length - good} incorrectos`
    $('samples').tBodies[0].replaceChildren()
    for (const sample of rows.slice(page * pageSize, (page + 1) * pageSize)) {
      const row = document.createElement('tr'); if (sample.bad) row.className = 'bad'
      for (const v of [sample.bucket, sample.slot, sample.status, sample.priceCents, sample.bad ? 'Incorrecto' : 'Correcto', sample.key]) cell(row, v)
      $('samples').tBodies[0].append(row)
    }
    $('page-previous').disabled = page === 0; $('page-next').disabled = (page + 1) * pageSize >= rows.length
    $('page-label').textContent = `${page * pageSize + 1}–${Math.min((page + 1) * pageSize, rows.length)} de ${rows.length}`
    const ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg')
    svg.setAttribute('viewBox', '0 0 380 160'); svg.setAttribute('role', 'img')
    svg.setAttribute('aria-label', `${http} de ${rows.length} respuestas HTTP 200 y ${good} precios correctos. Escala de cero a cien por ciento.`)
    for (const [i, [label, count, color]] of [['HTTP 200', http, '#38bdf8'], ['Precio correcto', good, '#34d399']].entries()) {
      const text = document.createElementNS(ns, 'text'); text.setAttribute('x', '10'); text.setAttribute('y', String(24 + i * 70)); text.setAttribute('fill', '#f8fafc'); text.setAttribute('font-size', '16'); text.textContent = `${label}: ${count}/${rows.length}`; svg.append(text)
      const rect = document.createElementNS(ns, 'rect')
      for (const [key, value] of Object.entries({ x: 10, y: 36 + i * 70, width: rows.length ? 360 * count / rows.length : 0, height: 24, fill: color })) rect.setAttribute(key, String(value))
      svg.append(rect)
    }
    $('sample-chart').replaceChildren(svg)
  }
  $('cohort').disabled = false; $('cohort').addEventListener('change', () => { page = 0; renderSamples() })
  for (const [id, delta] of [['page-previous', -1], ['page-next', 1]]) $(id).addEventListener('click', () => { page += delta; renderSamples() })
  for (const stage of data.events.find((e) => e.id === 'pipeline_completed').facts.stages) {
    const row = document.createElement('tr'); cell(row, stage.name); cell(row, stage.status); $('gates').tBodies[0].append(row)
  }
  renderEvent(); renderSamples()
} catch { $('notice').textContent = 'No se pudo leer la captura. Recarga o consulta el archivo en GitHub.' }
