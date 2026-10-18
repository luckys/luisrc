import { performance } from 'node:perf_hooks'

const before = process.memoryUsage()
const cpu = process.cpuUsage()
const buffer = Buffer.alloc(8 * 1024 * 1024, 1)
const after = process.memoryUsage()
const events = []
const start = performance.now()
setTimeout(() => {
  events.push('timer')
  const usage = process.cpuUsage(cpu)
  console.log(
    JSON.stringify({
      pid: process.pid,
      events,
      before,
      after,
      cpu_user_us: usage.user,
      cpu_system_us: usage.system,
      timer_elapsed_ms: performance.now() - start,
      touched: buffer[buffer.length - 1],
    }),
  )
}, 10)
events.push('busy:start')
while (performance.now() - start < 80) {} // Bloqueo deliberado y acotado en un proceso propio.
events.push('busy:end')
