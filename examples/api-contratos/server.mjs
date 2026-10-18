import { createServer, STATUS_CODES } from 'node:http'
import { pathToFileURL } from 'node:url'

class HttpError extends Error {
  constructor(status) {
    super(STATUS_CODES[status])
    this.status = status
  }
}

function object(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export function parseOrder(value) {
  if (
    !object(value) ||
    Object.keys(value).some(
      (key) => !['amountMinor', 'currency', 'label'].includes(key),
    ) ||
    !Number.isSafeInteger(value.amountMinor) ||
    value.amountMinor < 1 ||
    value.amountMinor > 1000000 ||
    !['EUR', 'USD'].includes(value.currency) ||
    ('label' in value &&
      (typeof value.label !== 'string' || [...value.label].length > 80))
  )
    throw new HttpError(422)
  return {
    amountMinor: value.amountMinor,
    currency: value.currency,
    ...('label' in value ? { label: value.label } : {}),
  }
}

export function patchOrder(current, patch) {
  if (
    !object(patch) ||
    Object.keys(patch).some((key) => key !== 'label') ||
    ('label' in patch &&
      patch.label !== null &&
      (typeof patch.label !== 'string' || [...patch.label].length > 80))
  )
    throw new HttpError(422)
  const next = { ...current }
  if (patch.label === null) delete next.label
  else if ('label' in patch) next.label = patch.label
  return next
}

async function readJSON(request) {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers['content-type'] ?? ''))
    throw new HttpError(415)
  let size = 0
  const chunks = []
  for await (const chunk of request) {
    size += chunk.length
    if (size <= 4096) chunks.push(chunk)
  }
  if (size > 4096) throw new HttpError(413)
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw new HttpError(400)
  }
}

function send(response, status, value, headers = {}) {
  response.writeHead(status, {
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...(value === undefined ? {} : { 'Content-Type': 'application/json; charset=utf-8' }),
    ...headers,
  })
  response.end(value === undefined ? undefined : JSON.stringify(value))
}

export function createApi() {
  const orders = new Map()
  let sequence = 0
  return createServer(async (request, response) => {
    try {
      const path = new URL(request.url, 'http://127.0.0.1').pathname
      const match = /^\/orders\/([a-zA-Z0-9_-]+)$/.exec(path)
      if (path !== '/orders' && !match) throw new HttpError(404)
      const allowed = match ? 'GET, PUT, PATCH, DELETE' : 'POST'
      if (!allowed.split(', ').includes(request.method)) {
        response.setHeader('Allow', allowed)
        throw new HttpError(405)
      }
      if (!match) {
        const input = parseOrder(await readJSON(request))
        const order = { id: `o${++sequence}`, ...input }
        orders.set(order.id, order)
        send(response, 201, order, { Location: `/orders/${order.id}` })
        return
      }
      const id = match[1]
      const current = orders.get(id)
      if (!current) throw new HttpError(404)
      if (request.method === 'GET') {
        send(response, 200, current)
        return
      }
      if (request.method === 'DELETE') {
        orders.delete(id)
        send(response, 204)
        return
      }
      const input = await readJSON(request)
      const next =
        request.method === 'PUT'
          ? { id, ...parseOrder(input) }
          : patchOrder(current, input)
      orders.set(id, next)
      send(response, 200, next)
    } catch (error) {
      const status = error instanceof HttpError ? error.status : 500
      send(
        response,
        status,
        { type: 'about:blank', title: STATUS_CODES[status], status },
        { 'Content-Type': 'application/problem+json' },
      )
    }
  })
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const server = createApi()
  server.listen(0, '127.0.0.1', () =>
    console.log(`API local: http://127.0.0.1:${server.address().port}`),
  )
  process.once('SIGINT', () => server.close())
  process.once('SIGTERM', () => server.close())
}
