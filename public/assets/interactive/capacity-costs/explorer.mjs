import { estimate, commitment, meanInFlight, simulate } from './model.mjs'
import { chart } from './chart.mjs'
const $ = id => document.getElementById(id)
const usd = value => {
  if (value === null) return 'No definido (denominador cero)'
  const n = BigInt(value)
  return (n / 1000000n).toString() + ',' + (n % 1000000n).toString().padStart(6,'0') + ' USD'
}
function table(id, rows) {
  $(id).replaceChildren(...rows.map(([name,value]) => {
    const tr = document.createElement('tr'), th = document.createElement('th'), td = document.createElement('td')
    th.scope = 'row'; th.textContent = name; td.textContent = String(value); tr.append(th,td); return tr
  }))
}
try {
  const response = await fetch('./comparison.json')
  if (!response.ok) throw Error('No se pudo cargar el informe')
  const data = await response.json(), input = data.input
  if (data.kind !== 'calculated_scenarios_and_fluid_simulation_not_measurements') throw Error('Formato inesperado')
  for (const p of input.profiles) { const o = document.createElement('option'); o.value = p.id; o.textContent = p.name; $('profile').append(o) }
  $('source').textContent = `Cálculos archivados: ${data.generatedAt}. Entradas hipotéticas; sin precios de proveedor.`
  const controls = [...document.querySelectorAll('select,input,button')]
  controls.forEach(e=>e.disabled=false)
  function render() {
    const profile = input.profiles.find(p=>p.id===$('profile').value)
    const shape = { ...input.shape, cpuMs: +$('cpu').value }
    const pricing = { ...input.pricing, bytesPerRequest: +$('payload').value, successBps: +$('success').value }
    const result = estimate(profile.segments, shape, input.rates, pricing)
    $('cpu-value').textContent = shape.cpuMs
    $('scope').textContent = result.feasibleCpuModel ? 'Cabe en el límite CPU del modelo. Capacidad real, latencia y disponibilidad sin verificar.' : 'INVIABLE con el máximo de ocho réplicas: el subtotal solo valora recursos limitados. No acredita atender toda la demanda.'
    table('costs', [['Peticiones ofrecidas',result.requests],['Peticiones buenas asumidas',result.goodRequests],['Horas-réplica ideales',result.replicaHours],['Compute',usd(result.lines.compute)],['Base fija',usd(result.lines.fixed)],['Peticiones',usd(result.lines.requests)],['Storage',usd(result.lines.storage)],['Egress',usd(result.lines.egress)],['Subtotal parcial',usd(result.subtotal)],['Por millón ofrecidas',usd(result.perMillionOffered)],['Por millón buenas asumidas',usd(result.perMillionGood)]])
    table('commitments', [2,6].flatMap(units=> {
      const r = commitment(profile.segments,shape,pricing.days,units,input.rates.replicaHour,'42000')
      return [[`${units} unidades: coste compute`,usd(r.cost)],[`${units} unidades: horas ociosas pagadas`,r.unusedUnitHours]]
    }))
    $('latency-value').textContent=$('latency').value
    $('little').textContent=`100 × ${+$('latency').value/1000} s = ${meanInFlight(100,+$('latency').value)} peticiones dentro del sistema, de media.`
    const mode = $('trace').value
    // The trace has fixed CPU demand, independent of the monthly CPU slider.
    const policy = { ...input.shape, ...input.policy, startup: +$('startup').value,
      ...(mode==='prewarmed'?{min:6}:{}), ...(mode==='slowDatabase'?{dbRps:200}:{}) }
    const rows = simulate(policy), i = +$('sample').value, row = rows[i]
    $('startup-value').textContent = policy.startup
    $('sample-value').textContent = `${row.time}–${row.until} s`
    $('chart').innerHTML = chart(rows,i)
    $('previous').disabled=i===0; $('next').disabled=i===rows.length-1
    table('snapshot', [['Demanda RPS',row.rps],['Techo RPS',row.capacityRps],['Réplicas listas',row.ready],['Objetivo calculado',row.desired],['Cola al final',row.queue],['Llegadas acumuladas',row.arrived],['Servidas acumuladas',row.served],['Rechazadas acumuladas',row.rejected]])
    $('facts').textContent=JSON.stringify({monthly:{profile,shape,pricing,result},simulation:{policy,selected:row,final:rows.at(-1)}},null,2)
  }
  for (const e of document.querySelectorAll('select,input')) e.addEventListener('input',render)
  $('previous').onclick=()=>{$('sample').value=Math.max(0,+$('sample').value-1);render()}
  $('next').onclick=()=>{$('sample').value=Math.min(59,+$('sample').value+1);render()}
  render()
} catch (error) {
  $('error').hidden=false; $('error').textContent='No se ha podido calcular: '+error.message
  document.querySelectorAll('select,input,button').forEach(e=>e.disabled=true)
}
