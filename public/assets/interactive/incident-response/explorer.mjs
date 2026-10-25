const data = await (await fetch('replay.json')).json()
const $ = (id) => document.getElementById(id)
const phase = $('phase'), select = $('event')
for (const name of new Set(data.events.map((e) => e.phase))) phase.add(new Option(name, name))
let visible = data.events
function cell(row, value) { const td = document.createElement('td'); td.textContent = value === undefined ? 'No capturado' : String(value); row.append(td); return td }
function show(id) {
  const event = data.events.find((e) => e.id === id)
  select.value = id
  $('summary').textContent = `#${event.seq} · ${event.id} · ${event.phase} · ${event.at} · +${event.elapsedMs.toFixed(3)} ms · ${event.kind}`
  const state = event.facts.state ?? (event.facts.jobs ? event.facts : {})
  const worker = state.worker ?? event.facts.worker
  const row = document.createElement('tr')
  for (const value of [state.accepted, state.completed, state.queued,
    worker ? `${worker.config.batchSize} / ${worker.config.revision}` : undefined,
    worker ? `${worker.ticks} / ${worker.attempts}` : undefined, state.admissionOpen]) cell(row, value)
  $('snapshot').replaceChildren(row)
  $('facts').textContent = JSON.stringify(event.facts, null, 2)
  const index = visible.findIndex((e) => e.id === id)
  $('previous').disabled = index <= 0
  $('next').disabled = index < 0 || index >= visible.length - 1
}
function filter() {
  visible = data.events.filter((e) => phase.value === 'all' || e.phase === phase.value)
  select.replaceChildren(...visible.map((e) => new Option(`${e.seq}. ${e.id}`, e.id)))
  select.disabled = false
  show(visible[0].id)
}
phase.addEventListener('change', filter)
select.addEventListener('change', () => show(select.value))
for (const [id, direction] of [['previous', -1], ['next', 1]]) $(id).addEventListener('click', () => {
  const index = visible.findIndex((e) => e.id === select.value)
  if (visible[index + direction]) show(visible[index + direction].id)
})
for (const action of data.actions) {
  const row = document.createElement('tr')
  for (const value of [action.id, action.owner, action.state, action.criterion]) cell(row, value)
  const td = document.createElement('td')
  if (action.proof) {
    const button = document.createElement('button'); button.textContent = action.proof
    button.addEventListener('click', () => { phase.value = 'all'; filter(); show(action.proof) })
    td.append(button)
  } else td.textContent = 'Abierta, sin prueba de cierre'
  row.append(td); $('actions').append(row)
}
filter()
