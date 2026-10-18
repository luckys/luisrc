import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { once } from 'node:events'
import { fileURLToPath } from 'node:url'

export async function browserServer() {
  const requests = []
  const files = new Map([
    ['/', 'browser.html'],
    ['/browser.mjs', 'browser.mjs'],
    ['/browser.css', 'browser.css'],
  ])
  const server = createServer(async (request, response) => {
    response.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self'; style-src 'self'; connect-src http://127.0.0.1:*; object-src 'none'; frame-ancestors 'none'",
    )
    response.setHeader('Cache-Control', 'no-store')
    if (request.url === '/api/whoami') {
      const authenticated = String(request.headers.cookie ?? '')
        .split(';')
        .some((value) => value.trim() === 'lab_session=fake')
      requests.push({ cookie_received: authenticated })
      response.setHeader('Content-Type', 'application/json')
      response.end(JSON.stringify({ authenticated }))
      return
    }
    const file = files.get(request.url)
    if (!file) {
      response.writeHead(404)
      response.end()
      return
    }
    if (request.url === '/')
      response.setHeader(
        'Set-Cookie',
        'lab_session=fake; HttpOnly; SameSite=Strict; Path=/',
      )
    const types = {
      html: 'text/html; charset=utf-8',
      mjs: 'text/javascript; charset=utf-8',
      css: 'text/css; charset=utf-8',
    }
    response.setHeader('Content-Type', types[file.split('.').at(-1)])
    try {
      response.end(await readFile(new URL(file, import.meta.url)))
    } catch {
      response.writeHead(500)
      response.end('Fixture no disponible')
    }
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  return {
    origin: `http://127.0.0.1:${server.address().port}`,
    requests,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()))
        server.closeIdleConnections()
      }),
  }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const app = await browserServer()
  console.log(app.origin)
  process.once('SIGINT', async () => {
    await app.close()
    process.exit(0)
  })
  process.once('SIGTERM', async () => {
    await app.close()
    process.exit(0)
  })
}
