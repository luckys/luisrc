import { createServer } from 'node:http'
import { once } from 'node:events'
import { createStore } from './store.mjs'
import { invalidInput, parseTitleChange, unsafeAssign } from './command.mjs'

// Credenciales públicas de fixtures. No son un sistema de login o tokens reales.
const fixtures = new Map([
  [
    'Bearer demo-alice',
    {
      subject: 'alice',
      tenantId: 'north',
      scopes: ['documents:read', 'documents:write', 'imports:run'],
    },
  ],
  [
    'Bearer demo-bob',
    {
      subject: 'bob',
      tenantId: 'south',
      scopes: ['documents:read', 'documents:write', 'imports:run'],
    },
  ],
])
const codes = {
  400: 'invalid_json',
  401: 'unauthenticated',
  403: 'forbidden',
  404: 'not_found',
  405: 'method_not_allowed',
  413: 'body_too_large',
  415: 'unsupported_media_type',
  422: 'invalid_input',
  429: 'too_many_requests',
  502: 'upstream_error',
  503: 'service_unavailable',
  504: 'upstream_timeout',
}
function reject(status) {
  throw Object.assign(new Error(codes[status]), { status })
}
function methodNotAllowed(response, allow) {
  response.setHeader('allow', allow)
  reject(405)
}
function json(response, status, data) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  })
  response.end(JSON.stringify(data))
}
async function readInput(request) {
  if (
    request.headers['content-type']?.split(';')[0].trim().toLowerCase() !==
    'application/json'
  )
    reject(415)
  const chunks = []
  let bytes = 0
  for await (const chunk of request) {
    bytes += chunk.length
    if (bytes > 4096) reject(413)
    chunks.push(chunk)
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    reject(400)
  }
}

export async function startLab({ importer, admission, identify } = {}) {
  const store = createStore()
  const server = createServer((request, response) => {
    handle(request, response).catch((error) => {
      const status = Object.hasOwn(codes, error.status) ? error.status : 500
      if (status === 401) response.setHeader('www-authenticate', 'Bearer realm="api-lab"')
      if (Number.isSafeInteger(error.retryAfter) && error.retryAfter > 0)
        response.setHeader('retry-after', String(error.retryAfter))
      json(response, status, { error: codes[status] ?? 'internal_error' })
    })
  })
  server.requestTimeout = 5000
  server.headersTimeout = 5000
  async function handle(request, response) {
    // Si se inyecta un verificador, el fixture público no actúa como fallback.
    const principal = identify
      ? await identify(request)
      : fixtures.get(request.headers.authorization)
    if (!principal) reject(401)
    const url = new URL(request.url, 'http://sandbox.invalid')
    const match = /^\/tenants\/([a-z]+)\/(documents|search|imports)(?:\/(d\d+))?$/.exec(
      url.pathname,
    )
    if (!match || match[1] !== principal.tenantId) reject(404)
    const [, tenantId, resource, id] = match
    const requireScope = (scope) => {
      if (!principal.scopes?.includes(scope)) reject(403)
    }
    const mode = url.searchParams.get('mode') ?? 'safe'
    if (resource === 'imports' && !id && importer) {
      if (request.method !== 'POST') methodNotAllowed(response, 'POST')
      requireScope('imports:run')
      const input = await readInput(request)
      if (admission && mode !== 'safe') throw invalidInput()
      const work = () => importer({ tenantId, mode, input })
      return json(
        response,
        200,
        await (admission ? admission.run(tenantId, work) : work()),
      )
    }
    if (!['safe', 'unsafe'].includes(mode)) throw invalidInput()
    if (resource === 'search' && !id) {
      if (request.method !== 'GET') methodNotAllowed(response, 'GET')
      requireScope('documents:read')
      const title = url.searchParams.get('title') ?? ''
      if (title.length > 120) throw invalidInput()
      const sort = url.searchParams.get('sort') ?? 'title'
      const rows =
        mode === 'unsafe'
          ? store.unsafeSearch(tenantId, title)
          : store.search(tenantId, title, sort)
      return json(response, 200, rows)
    }
    if (resource !== 'documents') reject(404)
    if (!id) {
      if (request.method !== 'GET') methodNotAllowed(response, 'GET')
      requireScope('documents:read')
      return json(response, 200, store.list(tenantId))
    }
    const document = store.get(tenantId, id)
    if (!document) reject(404)
    if (request.method === 'GET') {
      requireScope('documents:read')
      return json(response, 200, { id: document.id, title: document.title })
    }
    if (request.method !== 'PATCH') methodNotAllowed(response, 'GET, PATCH')
    requireScope('documents:write')
    if (document.ownerId !== principal.subject || document.state !== 'draft') reject(403)
    const input = await readInput(request)
    const next =
      mode === 'unsafe'
        ? unsafeAssign(document, input)
        : { ...document, ...parseTitleChange(input) }
    if (mode === 'unsafe') store.save(document, next)
    else if (!store.changeTitle(tenantId, id, principal.subject, next.title)) reject(403)
    return json(response, 200, { id: next.id, title: next.title })
  }
  try {
    server.listen(0, '127.0.0.1')
    await once(server, 'listening')
  } catch (error) {
    store.close()
    throw error
  }
  return {
    origin: `http://127.0.0.1:${server.address().port}`,
    store,
    async close() {
      await new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      )
      store.close()
    },
  }
}
