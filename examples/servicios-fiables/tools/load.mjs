import { createServer } from 'node:http'
import { once } from 'node:events'
import { performance } from 'node:perf_hooks'
import { writeFile, mkdir } from 'node:fs/promises'

// Servicio sintético LOCAL: espera 20 ms, acepta 4 operaciones a la vez y rechaza el resto.
let active = 0
const server = createServer((_request, response) => {
  if (active >= 4) {
    response.writeHead(503)
    response.end('overloaded')
    return
  }
  active++
  setTimeout(() => {
    active--
    response.writeHead(200)
    response.end('ok')
  }, 20)
})
server.listen(0, '127.0.0.1')
await once(server, 'listening')
const url = `http://127.0.0.1:${server.address().port}`
const stages = []
const percentile = (values, p) => values[Math.ceil(p * values.length) - 1]
try {
  // Warm-up fuera de la muestra.
  for (let i = 0; i < 5; i++) {
    const response = await fetch(url)
    await response.text()
  }
  for (const concurrency of [1, 4, 12]) {
    const samples = []
    let issued = 0
    const started = performance.now()
    await Promise.all(
      Array.from({ length: concurrency }, async () => {
        while (issued < 120) {
          issued++
          const before = performance.now()
          const response = await fetch(url, { signal: AbortSignal.timeout(5000) })
          await response.text()
          samples.push({ ms: performance.now() - before, status: response.status })
        }
      }),
    )
    const seconds = (performance.now() - started) / 1000
    const latencies = samples.map((sample) => sample.ms).sort((a, b) => a - b)
    const successes = samples.filter((sample) => sample.status === 200).length
    stages.push({
      concurrency,
      requests: samples.length,
      successes,
      errors: samples.length - successes,
      seconds,
      completed_rps: samples.length / seconds,
      successful_rps: successes / seconds,
      p50: percentile(latencies, 0.5),
      p95: percentile(latencies, 0.95),
      p99: percentile(latencies, 0.99),
      samples,
    })
  }
} finally {
  await new Promise((resolve) => server.close(resolve))
}
const results = {
  date: new Date().toISOString(),
  node: process.version,
  platform: process.platform,
  model: 'closed-loop',
  requests_per_stage: 120,
  synthetic_wait_ms: 20,
  max_active: 4,
  notes:
    'Cliente y servidor en el mismo proceso y host. Una ejecución, sin CPU aislada. Las latencias incluyen rechazos. No mide capacidad de un servicio real.',
  stages,
}
await mkdir(new URL('../results/', import.meta.url), { recursive: true })
await writeFile(
  new URL('../results/load.json', import.meta.url),
  JSON.stringify(results, null, 2) + '\n',
)
console.log(stages.map(({ samples, ...summary }) => summary))
