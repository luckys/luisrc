import { can } from './policy.mjs'

function fail(status, code) {
  return Object.assign(new Error(code), { status, code })
}

export function parsePatch(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw fail(400, 'invalid_patch')
  const keys = Object.keys(value)
  if (keys.length !== 1 || keys[0] !== 'title' || typeof value.title !== 'string')
    throw fail(400, 'invalid_patch')
  const title = value.title.trim()
  if (title.length === 0 || title.length > 120) throw fail(400, 'invalid_patch')
  return { title }
}

async function readPatch(request) {
  if (
    request.headers['content-type']?.split(';')[0].trim().toLowerCase() !==
    'application/json'
  )
    throw fail(415, 'json_required')
  const chunks = []
  let length = 0
  for await (const chunk of request) {
    length += chunk.length
    if (length > 4096) throw fail(413, 'body_too_large')
    chunks.push(chunk)
  }
  let value
  try {
    value = JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw fail(400, 'invalid_json')
  }
  return parsePatch(value)
}

function representation({ id, ownerId, state, title }) {
  return { id, ownerId, state, title }
}

function send(response, status, body, headers = {}) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...headers,
  })
  response.end(JSON.stringify(body))
}

export function createApp(store) {
  return async (request, response) => {
    try {
      const token = request.headers.authorization?.match(/^Bearer ([A-Za-z0-9-]+)$/)?.[1]
      const subject = store.authenticate(token)
      if (!subject) {
        send(
          response,
          401,
          { error: 'authentication_required' },
          {
            'WWW-Authenticate': 'Bearer realm="permissions-lab"',
          },
        )
        return
      }
      const url = new URL(request.url, 'http://127.0.0.1')
      const route = url.pathname.match(
        /^\/tenants\/([a-z-]+)\/documents(?:\/([a-z-]+))?$/,
      )
      if (!route) throw fail(404, 'not_found')
      const [, tenantId, id] = route
      const allowed = id ? ['GET', 'PATCH'] : ['GET']
      if (!allowed.includes(request.method)) {
        send(
          response,
          405,
          { error: 'method_not_allowed' },
          { Allow: allowed.join(', ') },
        )
        return
      }
      // Leer el body antes de consultar permisos: después no hay await entre decisión y escritura.
      const patch = request.method === 'PATCH' ? await readPatch(request) : null
      const role = store.membership(subject, tenantId)
      if (!role) throw fail(404, 'not_found')
      const context = { subject, role, tenantId }
      const scoped = store.inTenant(context.tenantId)
      if (!id) {
        const rawLimit = url.searchParams.get('limit') ?? '20'
        if (!/^[1-9][0-9]?$/.test(rawLimit) || Number(rawLimit) > 20)
          throw fail(400, 'invalid_limit')
        const visible = scoped.list().filter((row) => can(context, 'read', row))
        send(response, 200, {
          items: visible.slice(0, Number(rawLimit)).map(representation),
          total: visible.length,
        })
        return
      }
      const document = scoped.find(id)
      if (!can(context, 'read', document)) throw fail(404, 'not_found')
      if (patch) {
        if (!can(context, 'write', document)) throw fail(403, 'forbidden')
        send(response, 200, representation(scoped.rename(id, patch.title)))
        return
      }
      send(response, 200, representation(document))
    } catch (error) {
      const known =
        Number.isInteger(error.status) && error.status >= 400 && error.status < 500
      send(response, known ? error.status : 500, {
        error: known ? error.code : 'internal_error',
      })
    }
  }
}
