const byId = (id) => document.getElementById(id)
const number = (n) => n === null ? 'Sin muestras' : n.toLocaleString('es-ES', { maximumFractionDigits: 2 })
try {
  const response = await fetch('./measurements.json')
  if (!response.ok) throw new Error('No se pudieron cargar los datos archivados')
  const data = await response.json()
  const select = byId('scenario')
  select.replaceChildren(...data.stages.map((stage) => new Option(stage.name, stage.name)))
  const requested = new URLSearchParams(location.search).get('stage')
  if (data.stages.some((stage) => stage.name === requested)) select.value = requested
  function render() {
    const stage = data.stages.find((stage) => stage.name === select.value)
    byId('configuration').textContent = stage.mode === 'open'
      ? `Open-loop: ${stage.configuredRate} iteraciones/s, ${stage.vus} VUs, ${stage.nominalSeconds} s nominales.`
      : `Closed-loop: ${stage.vus} VUs, ${stage.nominalSeconds} s nominales.`
    const fields = [['Respuestas', stage.requests], ['Éxitos', stage.successes], ['Otras respuestas', stage.errors],
      ['No iniciadas', stage.dropped], ['Éxitos/s', stage.successfulRps], ['p95 todas (ms)', stage.all.p95], ['p95 éxitos (ms)', stage.success.p95]]
    byId('metrics').replaceChildren(...fields.map(([label, value]) => {
      const box = document.createElement('div')
      const dt = document.createElement('dt'); dt.textContent = label
      const dd = document.createElement('dd'); dd.textContent = number(value)
      box.append(dt, dd); return box
    }))
    byId('good').style.width = `${stage.requests ? stage.successes / stage.requests * 100 : 0}%`
    byId('bar').setAttribute('aria-label', `${stage.successes} éxitos y ${stage.errors} respuestas no exitosas`)
    byId('note').textContent = stage.dropped > 0
      ? `${stage.dropped} iteraciones no se iniciaron por falta de VUs. No son respuestas HTTP 503.`
      : stage.errors > 0 ? 'El servidor rechazó parte del trabajo. Los errores rápidos no son operaciones completadas con éxito.'
        : 'No se observaron errores ni iteraciones descartadas en esta fase. No es una garantía para otras cargas o duraciones.'
    byId('windows').hidden = stage.windows.length === 0
    byId('rows').replaceChildren(...stage.windows.map((window) => {
      const row = document.createElement('tr')
      for (const value of [`${window.fromSecond} s`, number(window.requests), number(window.errors), `${number(window.success.p95)} ms`, window.complete ? 'Cubierta' : 'Parcial']) {
        const cell = document.createElement('td'); cell.textContent = value; row.append(cell)
      }
      return row
    }))
  }
  select.disabled = false
  select.addEventListener('change', render)
  render()
} catch (error) { byId('result').textContent = error.message }
