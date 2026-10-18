import { transport } from './concepts.mjs'

const controls = ['latency', 'recovery', 'deadline'].map((id) =>
  document.querySelector(`#${id}`),
)
const ns = 'http://www.w3.org/2000/svg'
function element(name, attributes, text) {
  const node = document.createElementNS(ns, name)
  for (const [key, value] of Object.entries(attributes))
    node.setAttribute(key, String(value))
  if (text) node.textContent = text
  return node
}
function draw(rows, color, value, dashed = false) {
  const group = document.querySelector('#curves')
  let path = '',
    start = true
  for (const row of rows) {
    const time = value(row)
    if (time === null) {
      start = true
      continue
    }
    const x = 70 + row.id * 100,
      y = 280 - (time / 420) * 240
    path += `${start ? 'M' : 'L'}${x} ${y} `
    start = false
    group.append(element('circle', { cx: x, cy: y, r: 5, fill: color }))
  }
  group.append(
    element('path', {
      d: path,
      fill: 'none',
      stroke: color,
      'stroke-width': 3,
      ...(dashed ? { 'stroke-dasharray': '5 5' } : {}),
    }),
  )
}
function update() {
  const options = Object.fromEntries(
    controls.map((control) => [control.id, Number(control.value)]),
  )
  for (const control of controls)
    document.querySelector(`#${control.id}-value`).textContent = control.value
  const ordered = transport({ ...options, mode: 'ordered' }),
    datagram = transport({ ...options, mode: 'datagram' })
  const late = ordered.filter((row) => row.late).length
  const lost = datagram.filter((row) => row.delivered === null).length
  const onTime = datagram.filter((row) => row.delivered !== null && !row.late).length
  document.querySelector('#summary').textContent =
    `Ordenada: ${late} unidades tarde. Datagramas: ${lost} sin entrega y ${onTime} dentro de plazo.`
  document.querySelector('#curves').replaceChildren()
  draw(ordered, '#38bdf8', (row) => row.delivered)
  draw(datagram, '#fbbf24', (row) => row.delivered)
  draw(ordered, '#c4b5fd', (row) => row.deadline, true)
  for (const row of ordered)
    document
      .querySelector('#curves')
      .append(
        element(
          'text',
          { x: 70 + row.id * 100, y: 304, fill: '#e2e8f0', 'text-anchor': 'middle' },
          String(row.id),
        ),
      )
  document.querySelector('#rows').replaceChildren(
    ...ordered.map((row, index) => {
      const tr = document.createElement('tr')
      for (const value of [
        row.id,
        row.deadline,
        row.delivered + (row.late ? ' (tarde)' : ''),
        datagram[index].delivered === null
          ? 'Sin entrega'
          : datagram[index].delivered + (datagram[index].late ? ' (tarde)' : ''),
      ]) {
        const td = document.createElement('td')
        td.textContent = String(value)
        tr.append(td)
      }
      return tr
    }),
  )
}
for (const control of controls) control.addEventListener('input', update)
update()
