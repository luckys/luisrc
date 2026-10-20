import { createServer } from 'node:http'
import { randomBytes, timingSafeEqual } from 'node:crypto'
import { readFile } from 'node:fs/promises'

const render = await readFile(new URL('./render.mjs', import.meta.url))
const html = (body) =>
  `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Sandbox local de navegador</title><body><h1>Solo datos ficticios</h1>${body}</body></html>`
const fail = (status) => Object.assign(new Error('request rejected'), { status })
const token = () => randomBytes(24).toString('hex')

export function contentPolicy(nonce) {
  return `default-src 'none'; script-src 'nonce-${nonce}'; img-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'`
}

export function validMutation(request, session, app, csrf) {
  if (request.headers.origin !== app) return false
  if (typeof csrf !== 'string' || !/^[a-f0-9]{48}$/.test(csrf)) return false
  return timingSafeEqual(Buffer.from(csrf), Buffer.from(session.csrf))
}

async function formBody(request) {
  if (
    request.headers['content-type']?.split(';')[0] !== 'application/x-www-form-urlencoded'
  )
    throw fail(415)
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > 4096) throw fail(413)
    chunks.push(chunk)
  }
  const data = new URLSearchParams(Buffer.concat(chunks).toString('utf8'))
  if ([...data.keys()].some((key) => !['title', 'csrf'].includes(key))) throw fail(400)
  if (data.getAll('title').length !== 1 || data.getAll('csrf').length > 1) throw fail(400)
  const title = data.get('title')?.trim()
  if (!title || title.length > 120) throw fail(400)
  return { title, csrf: data.get('csrf') }
}

export async function startLab() {
  const sessions = new Map()
  const metrics = { options: 0, patch: 0 }
  const servers = []
  let app, attacker, trusted
  function send(response, status, body, type = 'application/json') {
    response.writeHead(status, {
      'content-type': `${type}; charset=utf-8`,
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    })
    response.end(type === 'application/json' ? JSON.stringify(body) : body)
  }
  function sessionOf(request) {
    const id = request.headers.cookie
      ?.split(';')
      .map((p) => p.trim())
      .find((p) => p.startsWith('lab_session='))
      ?.slice(12)
    const session = sessions.get(id)
    if (!session || Date.now() >= session.expires) throw fail(401)
    return session
  }
  function cors(request, response, mode) {
    response.setHeader('Vary', 'Origin')
    if (mode === 'wildcard') {
      // Configuración deliberadamente inválida con credentials: include.
      response.setHeader('Access-Control-Allow-Origin', '*')
      response.setHeader('Access-Control-Allow-Credentials', 'true')
    } else if (mode === 'allow' && request.headers.origin === trusted) {
      response.setHeader('Access-Control-Allow-Origin', trusted)
      response.setHeader('Access-Control-Allow-Credentials', 'true')
    }
  }
  async function application(request, response) {
    const url = new URL(request.url, app)
    if (request.method === 'GET' && url.pathname === '/session') {
      const id = token()
      sessions.set(id, {
        csrf: token(),
        title: 'Original',
        expires: Date.now() + 30 * 60_000,
      })
      // HTTP loopback: no Secure. No copiar este endpoint de fixture a producción.
      response.setHeader(
        'Set-Cookie',
        `lab_session=${id}; Path=/; HttpOnly; SameSite=Lax`,
      )
      return send(
        response,
        200,
        html('<p>Sesión ficticia iniciada durante 30 minutos.</p>'),
        'text/html',
      )
    }
    if (request.method === 'GET' && url.pathname === '/session-view')
      return send(
        response,
        200,
        html('<p>Lectura del estado desde el origen de la aplicación.</p>'),
        'text/html',
      )
    if (request.method === 'GET' && url.pathname === '/render.mjs')
      return send(response, 200, render, 'text/javascript')
    if (request.method === 'GET' && url.pathname === '/xss') {
      const mode = url.searchParams.get('mode')
      if (!['unsafe', 'safe', 'enforce', 'report'].includes(mode)) throw fail(400)
      const nonce = randomBytes(18).toString('base64')
      if (mode === 'enforce')
        response.setHeader('Content-Security-Policy', contentPolicy(nonce))
      if (mode === 'report')
        response.setHeader('Content-Security-Policy-Report-Only', contentPolicy(nonce))
      return send(
        response,
        200,
        html(
          `<p>No publiques este sandbox.</p><div id="output"></div><script type="module" nonce="${nonce}" src="/render.mjs"></script>`,
        ),
        'text/html',
      )
    }
    const preflight = url.pathname.match(/^\/api\/preflight\/(closed|allow)$/)
    if (preflight) {
      cors(request, response, preflight[1])
      if (request.method === 'OPTIONS') {
        metrics.options++
        const headers = (request.headers['access-control-request-headers'] ?? '')
          .split(',')
          .map((h) => h.trim().toLowerCase())
          .filter(Boolean)
        if (
          preflight[1] !== 'allow' ||
          request.headers.origin !== trusted ||
          request.headers['access-control-request-method'] !== 'PATCH' ||
          headers.some((h) => !['content-type', 'x-lab'].includes(h))
        )
          throw fail(403)
        response.setHeader('Access-Control-Allow-Methods', 'PATCH')
        response.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Lab')
        return send(response, 204, '')
      }
      if (request.method !== 'PATCH') throw fail(405)
      metrics.patch++
      sessionOf(request)
      // No mutación: separa el control del navegador de la autorización real.
      return send(response, 200, { received: true })
    }
    const corsRoute = url.pathname.match(/^\/api\/cors\/(closed|allow|wildcard)$/)
    if (corsRoute && request.method === 'GET') {
      cors(request, response, corsRoute[1])
      return send(response, 200, { title: sessionOf(request).title })
    }
    if (request.method === 'GET' && url.pathname === '/api/state')
      return send(response, 200, { title: sessionOf(request).title })
    if (request.method === 'GET' && url.pathname === '/api/token')
      return send(response, 200, { csrf: sessionOf(request).csrf })
    const mutation = url.pathname.match(/^\/api\/title\/(safe|unsafe)$/)
    if (mutation) {
      if (request.method !== 'POST') {
        response.setHeader('Allow', 'POST')
        throw fail(405)
      }
      const session = sessionOf(request)
      const { title, csrf } = await formBody(request)
      if (mutation[1] === 'safe' && !validMutation(request, session, app, csrf))
        throw fail(403)
      session.title = title
      return send(response, 200, { title: session.title })
    }
    throw fail(404)
  }
  async function listen(handler) {
    const server = createServer((request, response) => {
      Promise.resolve(handler(request, response)).catch((error) => {
        send(response, error.status ?? 500, {
          error: error.status ? 'rejected' : 'internal_error',
        })
      })
    })
    server.requestTimeout = 5000
    server.headersTimeout = 5000
    servers.push(server)
    await new Promise((resolve, reject) => {
      server.once('error', reject)
      server.listen(0, '127.0.0.1', resolve)
    })
    return `http://127.0.0.1:${server.address().port}`
  }
  try {
    app = await listen(application)
    attacker = await listen((request, response) => {
      const url = new URL(request.url, attacker)
      if (url.pathname !== '/form')
        return send(
          response,
          200,
          html('<p>Origen no autorizado para leer.</p>'),
          'text/html',
        )
      const target = url.searchParams.get('target')
      if (!['safe', 'unsafe'].includes(target)) throw fail(400)
      return send(
        response,
        200,
        html(
          `<form method="POST" action="${app}/api/title/${target}"><input type="hidden" name="title" value="Desde otro origen"><button>Enviar formulario de prueba</button></form>`,
        ),
        'text/html',
      )
    })
    trusted = await listen((_request, response) =>
      send(
        response,
        200,
        html('<p>Origen permitido en CORS, no autenticación.</p>'),
        'text/html',
      ),
    )
  } catch (error) {
    for (const server of servers) server.close()
    throw error
  }
  return {
    app,
    attacker,
    trusted,
    crossSite: attacker.replace('127.0.0.1', 'localhost'),
    metrics,
    async close() {
      await Promise.all(
        servers.map(
          (server) =>
            new Promise((resolve) => {
              server.close(resolve)
              server.closeAllConnections()
            }),
        ),
      )
      sessions.clear()
    },
  }
}
