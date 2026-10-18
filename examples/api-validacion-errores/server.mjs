import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { ApiError, toProblem } from './problems.mjs'
import { ReservationInput, ReservationOutput, fieldErrors } from './validation.mjs'
import { createInventory, reserve } from './service.mjs'

async function readJSON(request) {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers['content-type'] ?? ''))
    throw new ApiError('unsupported_media_type')
  let size = 0
  const chunks = []
  for await (const chunk of request) {
    size += chunk.length
    if (size <= 4096) chunks.push(chunk)
  }
  if (size > 4096) throw new ApiError('payload_too_large')
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks))
    return JSON.parse(text)
  } catch {
    throw new ApiError('malformed_json')
  }
}

export function createApi({ inventory = createInventory(), logger = () => {} } = {}) {
  return createServer(async (request, response) => {
    const requestId = randomUUID()
    let status = 200
    let body
    let route = 'unmatched'
    try {
      const path = new URL(request.url, 'http://127.0.0.1').pathname
      if (path !== '/reservations') throw new ApiError('not_found')
      route = '/reservations'
      if (request.method !== 'POST') {
        response.setHeader('Allow', 'POST')
        throw new ApiError('method_not_allowed')
      }
      const result = ReservationInput.safeParse(await readJSON(request))
      if (!result.success) throw new ApiError('invalid_input', fieldErrors(result.error))
      body = ReservationOutput.parse(reserve(inventory, result.data))
    } catch (error) {
      body = toProblem(error, requestId)
      status = body.status
    }
    response.writeHead(status, {
      'Content-Type': status === 200 ? 'application/json' : 'application/problem+json',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-Request-Id': requestId,
    })
    response.end(JSON.stringify(body))
    // Un fallo de telemetría no debe intentar responder dos veces o repetir el comando.
    try {
      logger({
        requestId,
        method: request.method === 'POST' ? 'POST' : 'other',
        route,
        status,
        code: status === 200 ? 'ok' : body.code,
      })
    } catch {
      /* El laboratorio no dispone de un segundo sink de diagnóstico. */
    }
  })
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const server = createApi({ logger: (entry) => console.log(JSON.stringify(entry)) })
  server.listen(0, '127.0.0.1', () =>
    console.log(`API local: http://127.0.0.1:${server.address().port}`),
  )
  process.once('SIGINT', () => server.close())
  process.once('SIGTERM', () => server.close())
}
