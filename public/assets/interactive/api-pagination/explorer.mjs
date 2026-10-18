import { simulateChange } from './model.mjs'
const explanations = {
  none: 'Sin cambios, las dos estrategias recorren los mismos IDs.',
  insert:
    'La inserción delante desplaza las posiciones: OFFSET repite 999988. Keyset continúa desde la clave guardada, pero no incorpora el nuevo pedido de delante.',
  move: 'La primera fila cambia su clave y pasa detrás del cursor. Puede reaparecer con keyset: continuar desde una clave no congela el conjunto.',
  delete:
    'Borrar delante desplaza las posiciones y OFFSET omite una fila pendiente. Keyset conserva la frontera; el snapshot representa la vista anterior al borrado.',
}
const change = document.querySelector('#change')
function render() {
  const result = simulateChange(change.value)
  document.querySelector('#explanation').textContent = explanations[change.value]
  for (const [name, ids] of Object.entries(result)) {
    const list = document.querySelector(`#${name}`)
    list.replaceChildren(
      ...ids.map((id) => {
        const item = document.createElement('li')
        const repeated = name !== 'first' && result.first.includes(id)
        item.textContent = repeated ? `${id} (repetido)` : id
        if (repeated) item.className = 'duplicate'
        return item
      }),
    )
  }
}
change.addEventListener('change', render)
document.querySelector('#reset').addEventListener('click', () => {
  change.value = 'none'
  render()
})
render()
