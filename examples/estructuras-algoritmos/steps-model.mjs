export function parseNumbers(text) {
  if (!text.trim()) return []
  const parts = text.split(',')
  const values = parts.map((value) => Number(value.trim()))
  if (
    parts.length > 21 ||
    parts.some((value) => !value.trim()) ||
    values.some((value) => !Number.isFinite(value))
  )
    throw new RangeError('Escribe hasta 21 números finitos separados por comas.')
  return values
}

export function binarySteps(items, target) {
  if (
    !Number.isFinite(target) ||
    items.some((value, i) => !Number.isFinite(value) || (i > 0 && value < items[i - 1]))
  )
    throw new RangeError(
      'La búsqueda binaria necesita números finitos ordenados y un objetivo finito.',
    )
  const steps = []
  let low = 0,
    high = items.length
  while (low < high) {
    const middle = low + Math.floor((high - low) / 2)
    const smaller = items[middle] < target
    steps.push({
      items: [...items],
      low,
      high,
      middle,
      message: `Intervalo [${low}, ${high}). Centro ${middle}: ${items[middle]} ${smaller ? '<' : '≥'} ${target}. ${smaller ? `El próximo low será ${middle + 1}.` : `El próximo high será ${middle}.`}`,
    })
    if (smaller) low = middle + 1
    else high = middle
  }
  steps.push({
    items: [...items],
    low,
    high,
    result: low,
    message: `Intervalo vacío. Lower bound = ${low}. ${low < items.length && items[low] === target ? 'Hay coincidencia.' : 'No hay coincidencia exacta.'}`,
  })
  return steps
}

export function insertionSteps(input) {
  if (input.some((value) => !Number.isFinite(value)))
    throw new RangeError('Valores no finitos')
  const items = [...input]
  const steps = [
    {
      items: [...items],
      message: 'Entrada original. El prefijo de un elemento ya está ordenado.',
    },
  ]
  for (let i = 1; i < items.length; i++) {
    const value = items[i]
    let j = i
    while (j > 0 && items[j - 1] > value) {
      items[j] = items[j - 1]
      j--
      steps.push({
        items: [...items],
        active: j,
        held: value,
        message: `Desplazamiento: ${value} está guardado fuera del array. El hueco está en ${j}; el valor repetido visible no es un duplicado de la entrada.`,
      })
    }
    items[j] = value
    steps.push({
      items: [...items],
      active: j,
      message: `Insertar ${value} en ${j}. El prefijo [0, ${i + 1}) está ordenado.`,
    })
  }
  steps.push({
    items: [...items],
    message: 'Salida ordenada. La entrada original no se ha modificado.',
  })
  return steps
}
