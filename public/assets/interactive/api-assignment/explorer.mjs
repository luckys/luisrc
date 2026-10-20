import { simulateAssignment } from './command.mjs'
const examples = {
  normal: { title: 'Nuevo título' },
  protected: {
    title: 'Nuevo título',
    ownerId: 'bob',
    state: 'published',
    tenantId: 'south',
  },
  unknown: { title: 'Nuevo título', futurePrivilege: true },
  nested: { title: 'Nuevo título', profile: { role: 'admin' } },
}
const payload = document.querySelector('#payload')
const example = document.querySelector('#example')
function render() {
  let input
  let malformed = false
  try {
    input = JSON.parse(payload.value)
  } catch {
    malformed = true
  }
  for (const mode of ['unsafe', 'safe']) {
    const result = simulateAssignment(mode, malformed ? {} : input)
    if (malformed) {
      result.status = 400
      result.after = result.before
    }
    const count = ['tenantId', 'ownerId', 'state'].filter(
      (key) => result.before[key] !== result.after[key],
    ).length
    document.querySelector(`#${mode}-status`).textContent =
      `Resultado simulado: ${result.status}`
    const meter = document.querySelector(`#${mode}-meter`)
    meter.value = count
    meter.textContent = `${count} de 3`
    document.querySelector(`#${mode}-count`).textContent =
      `${count} de 3 propiedades protegidas modificadas`
    document.querySelector(`#${mode}-after`).textContent = JSON.stringify(
      result.after,
      null,
      2,
    )
  }
}
function choose() {
  payload.value =
    example.value === 'malformed'
      ? '{"title":'
      : JSON.stringify(examples[example.value], null, 2)
  render()
}
example.addEventListener('change', choose)
document.querySelector('#apply').addEventListener('click', render)
document.querySelector('#reset').addEventListener('click', () => {
  example.value = 'normal'
  choose()
})
choose()
