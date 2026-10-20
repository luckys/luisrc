import { timeline } from './timeline.mjs'
const input = document.querySelector('#interval')
function render() {
  const result = timeline(Number(input.value))
  document.querySelector('#value').textContent = input.value
  const polls = result.polls.map((poll) => {
    const span = document.createElement('span')
    span.textContent = `${poll.time}s → v${poll.version}`
    return span
  })
  document.querySelector('#polls').replaceChildren(...polls)
  document.querySelector('#rows').replaceChildren(
    ...result.observations.map((observation) => {
      const row = document.createElement('tr')
      for (const value of [
        observation.changedAt,
        observation.observedAt ?? 'Fuera de ventana',
        observation.observedAt === null
          ? 'No observada'
          : observation.observedAt - observation.changedAt,
      ]) {
        const cell = document.createElement('td')
        cell.textContent = String(value)
        row.append(cell)
      }
      return row
    }),
  )
  document.querySelector('#summary').textContent =
    `${result.polls.length} lecturas en la ventana, incluida la inicial. Dos cambios pueden descubrirse en la misma lectura.`
}
input.addEventListener('input', render)
render()
