const byId = (id) => document.getElementById(id)
const names = ['Clúster e Ingress preparados', 'Image importada al runtime local', 'Provider inicializado y HCL validado', 'Plan de creación revisado', 'Apply y respuesta HTTP esperada', 'Plan sin cambios', 'Pod repuesto sin apply', 'Drift manual detectado', 'Objetivo declarado recuperado', 'Plan obsoleto rechazado', 'Reemplazo planificado', 'Reemplazo aplicado', 'Refresh-only conserva el cambio remoto', 'Apply ordinario recupera el objetivo', 'Recursos propios destruidos', 'Clúster local eliminado']
const explanations = {
  pod_reconciled_without_apply: 'Kubernetes repuso el Pod con otro UID. El plan de Terraform no necesitó cambiar el Deployment.',
  drift_detected: 'El mensaje HTTP cambió fuera de Terraform. El plan propone una actualización del ConfigMap.',
  stale_plan_rejected: 'Otro apply avanzó el state. El archivo de plan anterior fue rechazado; la respuesta conserva el cambio nuevo.',
  refresh_only_does_not_repair: 'Refresh-only aceptó observaciones en state sin reparar el recurso. Se muestra el plan ordinario posterior, que aún propone una actualización.',
  replacement_planned: 'Una revisión nueva cambia el nombre del ConfigMap: creación antes de borrado y actualización de su consumidor.',
}
function row(cells) { const tr = document.createElement('tr'); for (const text of cells) { const td = document.createElement('td'); td.textContent = String(text); tr.append(td) } return tr }
let data, index = 0
function show() {
  const event = data.events[index], facts = event.facts
  byId('phase-title').textContent = names[index]
  byId('event').value = String(index); byId('previous').disabled = index === 0; byId('next').disabled = index === data.events.length - 1
  byId('summary').textContent = '#' + event.seq + ' · ' + event.id + ' · ' + event.at
  byId('explanation').textContent = explanations[event.id] ?? 'Los datos corresponden únicamente a esta fase del recorrido local.'
  const value = (v) => v === undefined ? 'No capturado' : String(v)
  byId('snapshot').replaceChildren(...[
    ['HTTP del catálogo', facts.http?.status], ['Mensaje devuelto', facts.http?.body.message],
    ['Recursos en state', facts.resourcesInState], ['Namespace ausente', facts.namespaceAbsent],
    ['Fixture presente en state', facts.stateContainsDummyValue], ['Motivo de rechazo', facts.reason],
  ].map(([label, v]) => row([label, value(v)])))
  const plan = facts.normalPlan ?? facts.plan ?? facts.terraformPlan ?? (facts.counts ? facts : undefined)
  byId('plan-kind').textContent = facts.normalPlan ? 'Plan ordinario posterior a refresh-only.' : plan ? 'Acciones propuestas por el plan registrado en esta fase.' : ''
  byId('plan').hidden = !plan
  byId('no-plan').textContent = plan ? (plan.changes.length ? '' : 'Sin acciones propuestas sobre recursos.') : 'No hay un plan capturado en esta fase.'
  if (plan) {
    const max = Math.max(plan.counts.create, plan.counts.update, plan.counts.delete, 1)
    byId('bars').replaceChildren(...[['create', 'Crear'], ['update', 'Actualizar'], ['delete', 'Borrar']].map(([key, label]) => {
      const block = document.createElement('div'); block.className = 'bar-row'
      const text = document.createElement('p'); text.textContent = label + ': ' + plan.counts[key]
      const track = document.createElement('div'); track.className = 'bar'; track.setAttribute('aria-hidden', 'true')
      const bar = document.createElement('div'); bar.id = key + '-bar'; bar.className = 'fill'; bar.style.width = (100 * plan.counts[key] / max) + '%'
      track.append(bar); block.append(text, track); return block
    }))
    byId('replacements').textContent = 'Reemplazos incluidos en crear/borrar: ' + plan.counts.replace + '. Escala común desde cero.'
    byId('changes').replaceChildren(...plan.changes.map((c) => row([c.address, c.actions.join(' → ')])))
  }
  byId('facts').textContent = JSON.stringify(facts, null, 2)
}
try {
  const response = await fetch('replay.json'); if (!response.ok) throw Error('missing_report'); data = await response.json()
  byId('capture').textContent = 'Captura: ' + data.capturedAt + '. Tipo: observación local de Terraform/Kubernetes.'
  for (const [i, event] of data.events.entries()) { const option = document.createElement('option'); option.value = String(i); option.textContent = '#' + event.seq + ' · ' + names[i]; byId('event').append(option) }
  byId('event').disabled = false; show()
  byId('event').addEventListener('change', () => { index = Number(byId('event').value); show() })
  byId('previous').addEventListener('click', () => { if (index > 0) { index--; show() } })
  byId('next').addEventListener('click', () => { if (index < data.events.length - 1) { index++; show() } })
} catch { byId('error').hidden = false; byId('error').textContent = 'No se pudo cargar la captura. No hay resultados disponibles.' }
