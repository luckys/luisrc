import { parseNumbers, binarySteps, insertionSteps } from './steps-model.mjs'
const $ = (id) => document.getElementById(id)
let steps = [],
  position = 0
function render() {
  const step = steps[position]
  $('position').textContent = `Paso ${position + 1} de ${steps.length}`
  $('message').textContent = step.message
  $('cells').replaceChildren(
    ...step.items.map((value, index) => {
      const cell = document.createElement('div')
      cell.className = 'cell'
      if (step.middle === index || step.active === index || step.result === index)
        cell.classList.add('active')
      if (step.low !== undefined && (index < step.low || index >= step.high))
        cell.classList.add('discarded')
      cell.textContent = String(value)
      const label = document.createElement('small')
      label.textContent = `índice ${index}`
      cell.append(label)
      return cell
    }),
  )
  $('previous').disabled = position === 0
  $('next').disabled = position === steps.length - 1
}
function prepare(event) {
  event?.preventDefault()
  try {
    const values = parseNumbers($('values').value)
    if (!$('target').value.trim() && $('algorithm').value === 'binary')
      throw new RangeError('Indica un objetivo finito.')
    steps =
      $('algorithm').value === 'binary'
        ? binarySteps(values, Number($('target').value))
        : insertionSteps(values)
    position = 0
    $('error').textContent = ''
    render()
  } catch (error) {
    $('error').textContent = error.message
    $('cells').replaceChildren()
    $('message').textContent = ''
    $('position').textContent = 'No hay un recorrido válido.'
    $('previous').disabled = $('next').disabled = true
  }
}
$('form').addEventListener('submit', prepare)
$('algorithm').addEventListener('change', () => {
  $('target').disabled = $('algorithm').value !== 'binary'
  $('target').required = !$('target').disabled
})
$('previous').addEventListener('click', () => {
  if (position > 0) {
    position--
    render()
  }
})
$('next').addEventListener('click', () => {
  if (position + 1 < steps.length) {
    position++
    render()
  }
})
prepare()
