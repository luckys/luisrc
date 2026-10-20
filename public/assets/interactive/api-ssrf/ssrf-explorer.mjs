const scenario = document.querySelector('#scenario')
const step = document.querySelector('#step')
const next = document.querySelector('#next')
const reset = document.querySelector('#reset')
let observations
const describe = (event) => {
  if (event.kind === 'lookup') return `Resolver de fixture devuelve ${event.address}`
  if (event.kind === 'request')
    return `Recibe una petición: ${event.destination === 'provider' ? 'proveedor ficticio' : 'destino interno no autorizado'}`
  return `La API responde HTTP ${event.status}`
}
function render() {
  const row = observations.find((item) => item.scenario === scenario.value)
  const visible = row.events.slice(0, Number(step.value))
  const list = document.querySelector('#events')
  list.replaceChildren(
    ...visible.map((event) => {
      const element = document.createElement('li')
      element.textContent = describe(event)
      return element
    }),
  )
  for (const destination of ['provider', 'internal']) {
    const count = visible.filter(
      (event) => event.kind === 'request' && event.destination === destination,
    ).length
    const meter = document.querySelector(`#${destination}`)
    meter.value = count
    meter.textContent = `${count} de 1`
    document.querySelector(`#${destination}-count`).textContent =
      count === 1 ? '1 petición recibida' : `${count} peticiones recibidas`
  }
  const complete = Number(step.value) === row.events.length
  document.querySelector('#progress').textContent =
    `${step.value} de ${row.events.length} pasos visibles`
  document.querySelector('#result').textContent = complete
    ? `Resultado observado: HTTP ${row.status}. ${row.text ?? 'Respuesta rechazada.'}`
    : 'Aún no se muestra la respuesta final.'
  next.disabled = complete
}
function choose() {
  step.max = observations.find((item) => item.scenario === scenario.value).events.length
  step.value = 0
  render()
}
try {
  const response = await fetch('./ssrf-evidence.json', { cache: 'no-store' })
  if (!response.ok) throw new Error('Evidence unavailable')
  observations = (await response.json()).observations
  for (const element of [scenario, step, next, reset]) element.disabled = false
  scenario.addEventListener('change', choose)
  step.addEventListener('input', render)
  next.addEventListener('click', () => {
    step.value = Number(step.value) + 1
    render()
  })
  reset.addEventListener('click', choose)
  document.querySelector('#load-status').textContent =
    'Evidencia local cargada. Elige un escenario y avanza.'
  choose()
} catch {
  for (const element of [scenario, step, next, reset]) element.disabled = true
  document.querySelector('#load-status').textContent =
    'No se pudo cargar la evidencia. Los controles siguen desactivados.'
}
