import { build } from 'esbuild'
import { createServer } from 'node:http'
import { readFile, mkdir } from 'node:fs/promises'
import { renderToString } from 'react-dom/server'
import { createElement } from 'react'
import { fileURLToPath } from 'node:url'

process.chdir(fileURLToPath(new URL('..', import.meta.url)))
await mkdir('dist', { recursive: true })
await build({
  entryPoints: ['src/client.tsx'],
  bundle: true,
  format: 'esm',
  outfile: 'dist/client.js',
  define: { 'process.env.NODE_ENV': '"production"' },
})
await build({
  entryPoints: ['src/App.tsx'],
  bundle: true,
  platform: 'node',
  packages: 'external',
  format: 'esm',
  outfile: 'dist/App.mjs',
})
const { App, initialOrder, views } = await import('../dist/App.mjs')
const { deliveries } = await import('./fixtures.mjs')
let order = { ...initialOrder }
let sequence = 0
const history = []
const subscribers = new Set()
const json = (res, value, status = 200) => {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  })
  res.end(JSON.stringify(value))
}
const encode = (event) => `id: ${event.id}\ndata: ${JSON.stringify(event)}\n\n`

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://127.0.0.1')
    if (req.method === 'GET' && url.pathname === '/client.js') {
      res.setHeader('Content-Type', 'text/javascript')
      res.end(await readFile('dist/client.js'))
      return
    }
    if (req.method === 'GET' && url.pathname === '/styles.css') {
      res.setHeader('Content-Type', 'text/css')
      res.end(await readFile('src/styles.css'))
      return
    }
    if (url.pathname === '/api/order' && req.method === 'PUT') {
      let body = ''
      for await (const chunk of req) {
        body += chunk
        if (body.length > 4096) {
          json(res, { error: 'too_large' }, 413)
          return
        }
      }
      const input = JSON.parse(body)
      if (
        typeof input.name !== 'string' ||
        !input.name.trim() ||
        input.name.length > 80
      ) {
        json(res, { error: 'invalid' }, 400)
        return
      }
      if (input.fail) {
        json(res, { error: 'rejected' }, 422)
        return
      }
      if (input.version !== order.version) {
        json(res, { error: 'conflict' }, 409)
        return
      }
      order = { ...order, name: input.name.trim(), version: order.version + 1 }
      json(res, order)
      return
    }
    if (url.pathname === '/api/search') {
      const query = (url.searchParams.get('q') ?? '').toLocaleLowerCase('es')
      json(
        res,
        deliveries
          .filter((row) => row.name.toLocaleLowerCase('es').includes(query))
          .slice(0, 20)
          .map((row) => row.name),
      )
      return
    }
    if (url.pathname === '/api/deliveries') {
      const page = Number(url.searchParams.get('page') ?? 0)
      if (!Number.isInteger(page) || page < 0 || page > 4999) {
        json(res, { error: 'invalid_page' }, 400)
        return
      }
      json(res, deliveries.slice(page * 20, page * 20 + 20))
      return
    }
    if (url.pathname === '/api/event' && req.method === 'POST') {
      const event = { id: ++sequence, type: 'changed' }
      history.push(event)
      if (history.length > 10) history.shift()
      for (const client of subscribers) client.write(encode(event))
      json(res, event)
      return
    }
    if (url.pathname === '/events') {
      const after = Number(
        req.headers['last-event-id'] ?? url.searchParams.get('after') ?? 0,
      )
      if (!Number.isSafeInteger(after) || after < 0) {
        json(res, { error: 'invalid_cursor' }, 400)
        return
      }
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'X-Accel-Buffering': 'no',
      })
      res.write('retry: 1000\n\n')
      if (after > sequence || after < sequence - history.length) {
        res.write(
          `id: ${sequence}\nevent: reset\ndata: ${JSON.stringify({ sequence })}\n\n`,
        )
      } else for (const event of history) if (event.id > after) res.write(encode(event))
      subscribers.add(res)
      const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 15000)
      res.on('close', () => {
        clearInterval(heartbeat)
        subscribers.delete(res)
      })
      return
    }
    if (url.pathname !== '/' || req.method !== 'GET') {
      res.writeHead(404)
      res.end('Not found')
      return
    }
    const view = views.includes(url.searchParams.get('view'))
      ? url.searchParams.get('view')
      : 'orders'
    const mode = url.searchParams.get('mode') === 'csr' ? 'csr' : 'ssr'
    const data = { view, mode, seed: order }
    const markup = mode === 'ssr' ? renderToString(createElement(App, data)) : ''
    // Evita cerrar el elemento script si un nombre contiene markup.
    const boot = JSON.stringify(data).replaceAll('<', '\\u003c')
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.setHeader('Cache-Control', 'no-store')
    res.end(
      `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Frontend y tiempo real: laboratorio</title><link rel="stylesheet" href="/styles.css"></head><body><div id="root">${markup}</div><script id="boot" type="application/json">${boot}</script><script type="module" src="/client.js"></script></body></html>`,
    )
  } catch (error) {
    if (!res.headersSent) json(res, { error: 'invalid_request' }, 400)
    else res.end()
    console.error(error.message)
  }
})
const port = Number(process.env.FRONTEND_LAB_PORT ?? 4399)
server.listen(port, '127.0.0.1', () =>
  console.log(`Laboratorio local: http://127.0.0.1:${port}`),
)
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => {
    for (const client of subscribers) client.end()
    server.close(() => process.exit(0))
  })
