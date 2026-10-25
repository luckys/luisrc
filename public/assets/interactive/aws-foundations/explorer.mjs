import { estimate } from './cost-model.mjs'
const byId = (id) => document.getElementById(id)
const fields = ['requests', 'memoryMb', 'billedMs', 'tasks', 'assumedLcu', 'interfaceGb']
const money = (value) => value.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 8 })
const labels = { requests: 'Peticiones Lambda', compute: 'Compute', httpApi: 'HTTP API', albHours: 'ALB-hora', albLcu: 'LCU-hora', endpointHours: 'Interfaces endpoint × AZ × hora', endpointData: 'GB de interfaces endpoint', publicIpv4: 'IPv4-hora' }
let data, base
function row(cells) {
  const tr = document.createElement('tr')
  for (const text of cells) { const td = document.createElement('td'); td.textContent = String(text); tr.append(td) }
  return tr
}
function readInputs() {
  const input = { ...base }
  for (const id of fields) {
    if (byId(id).value.trim() === '') throw Error('missing_value')
    input[id] = Number(byId(id).value)
  }
  const [cpu, memory] = byId('shape').value.split(',').map(Number)
  input.taskVcpu = cpu; input.taskMemoryGb = memory
  return input
}
function update() {
  try {
    const result = estimate(readInputs(), data.pricing.rates)
    const max = Math.max(result.lambda.subtotal, result.ecs.subtotal, 0.00000001)
    for (const key of ['lambda', 'ecs']) {
      byId(key + 'Total').textContent = money(result[key].subtotal) + ' USD'
      byId(key + 'Bar').style.width = (100 * result[key].subtotal / max) + '%'
    }
    byId('lines').replaceChildren(...['lambda', 'ecs'].flatMap((key) => Object.entries(result[key].lines).map(([line, value]) => row([key === 'lambda' ? 'Lambda' : 'ECS', labels[line], money(value)]))))
    byId('status').textContent = 'Calculado con tarifas archivadas. Capacidad equivalente no verificada.'
    byId('error').hidden = true; byId('result').hidden = false
  } catch {
    byId('result').hidden = true; byId('error').hidden = false
    byId('error').textContent = 'No calculado: revisa los valores y límites. El modelo acepta hasta 300 millones de peticiones, el primer tramo Lambda y las shapes disponibles. No uses campos vacíos, negativos o fracciones donde se exige un entero.'
  }
}
function selectCase() {
  byId('scenario-name').textContent = data.cases[Number(byId('scenario').value)].name
  base = { ...data.cases[Number(byId('scenario').value)].input }
  for (const id of fields) byId(id).value = String(base[id])
  byId('shape').value = base.taskVcpu + ',' + base.taskMemoryGb
  update()
}
try {
  const response = await fetch('comparison.json')
  if (!response.ok) throw Error('report_unavailable')
  data = await response.json()
  for (const [i, c] of data.cases.entries()) { const option = document.createElement('option'); option.value = String(i); option.textContent = c.name; byId('scenario').append(option) }
  byId('snapshot').textContent = 'Tarifas: ' + data.pricing.region + ' · ' + data.pricing.currency + ' · ' + data.pricing.capturedAt.slice(0, 10) + '. Evidencia local: ' + data.capturedAt.slice(0, 10) + '.'
  byId('observations').replaceChildren(...data.observations.map((o) => row([o.method + ' ' + o.path, o.http.status, o.localLambda.statusCode])))
  byId('contracts').textContent = 'Fallos parciales Standard: ' + data.contracts.queueResult.batchItemFailures.map((v) => v.itemIdentifier).join(', ') + '. Restauración RDS verificada: ' + (data.contracts.dbReview.restoreVerified ? 'sí' : 'no') + '. Servidor local cerrado tras captura: ' + (data.serverClosed ? 'sí' : 'no') + '.'
  byId('scenario').disabled = false; byId('reset').disabled = false
  byId('scenario').addEventListener('change', selectCase)
  byId('reset').addEventListener('click', selectCase)
  byId('controls').addEventListener('input', update)
  byId('controls').addEventListener('change', update)
  byId('controls').addEventListener('submit', (event) => event.preventDefault())
  selectCase()
} catch {
  byId('error').hidden = false; byId('error').textContent = 'No se pudo cargar el informe. No hay una estimación disponible.'
  byId('result').hidden = true
}
