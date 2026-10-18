export function checksum(bytes) {
  let sum = 0
  for (const value of bytes) sum += value
  return sum
}

export function traces() {
  return {
    sequential: Array.from({ length: 128 }, (_, i) => i % 32),
    blocked: Array.from({ length: 32 }, (_, i) => Array(4).fill(i)).flat(),
  }
}

// Modelo didáctico fully-associative LRU, no simulación de una CPU concreta.
export function cacheTrace(addresses, capacity = 4, lineSize = 4) {
  if (
    !Number.isInteger(capacity) ||
    capacity < 1 ||
    !Number.isInteger(lineSize) ||
    lineSize < 1
  )
    throw new Error('Capacidad y línea positivas')
  const lines = new Map()
  let misses = 0
  const events = []
  for (const address of addresses) {
    if (!Number.isSafeInteger(address) || address < 0)
      throw new Error('Dirección inválida')
    const block = Math.floor(address / lineSize)
    const hit = lines.has(block)
    if (!hit) misses++
    lines.delete(block)
    lines.set(block, true)
    if (lines.size > capacity) lines.delete(lines.keys().next().value)
    events.push({ address, block, hit, lines: [...lines.keys()] })
  }
  return { misses, hits: addresses.length - misses, events }
}

// Contrato de ejemplo: no negativo, punto decimal y exactamente dos decimales.
export function minorUnits(text) {
  const parts = /^(0|[1-9]\d*)\.(\d{2})$/.exec(text)
  if (!parts) throw new Error('Se necesita un decimal no negativo con dos posiciones')
  return BigInt(parts[1]) * 100n + BigInt(parts[2])
}

export function representation() {
  const bytes = Buffer.from('España', 'utf8')
  let truncated_rejected = false
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.of(0xc3))
  } catch {
    truncated_rejected = true
  }
  const decoder = new TextDecoder('utf-8', { fatal: true })
  const streaming =
    decoder.decode(Uint8Array.of(0xc3), { stream: true }) +
    decoder.decode(Uint8Array.of(0xb1))
  return {
    float_sum: 0.1 + 0.2,
    minor_sum: (minorUnits('0.10') + minorUnits('0.20')).toString(),
    text: bytes.toString('utf8'),
    mojibake: bytes.toString('latin1'),
    bytes: bytes.length,
    hex: bytes.toString('hex'),
    truncated_rejected,
    streaming,
    same_instant:
      new Date('2026-10-18T12:00:00+02:00').getTime() ===
      new Date('2026-10-18T10:00:00Z').getTime(),
  }
}

// Tiempos hipotéticos, en ms; no modela ventanas, ACK, RTT adaptativo o congestión.
export function transport({
  mode = 'ordered',
  lost = 1,
  recovery = 100,
  latency = 40,
  deadline = 80,
} = {}) {
  if (!['ordered', 'datagram'].includes(mode)) throw new Error('Modo inválido')
  if (!Number.isInteger(lost) || lost < -1 || lost > 5)
    throw new Error('Paquete perdido inválido')
  if (![recovery, latency, deadline].every((x) => Number.isFinite(x) && x >= 0))
    throw new Error('Tiempo inválido')
  let previous = 0
  return Array.from({ length: 6 }, (_, id) => {
    const sent = id * 20
    let delivered = sent + latency
    if (id === lost) delivered = mode === 'datagram' ? null : delivered + recovery
    if (mode === 'ordered') {
      delivered = Math.max(delivered, previous)
      previous = delivered
    }
    return {
      id,
      sent,
      delivered,
      deadline: sent + deadline,
      late: delivered !== null && delivered > sent + deadline,
    }
  })
}
