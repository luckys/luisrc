import { createServer } from 'node:http'
import { createHash } from 'node:crypto'

export function resourceServer() {
  let body = JSON.stringify({ version: 1, title: 'Fixture' })
  const server = createServer((request, response) => {
    if (request.url !== '/resource') {
      response.writeHead(404)
      response.end()
      return
    }
    if (!['GET', 'HEAD'].includes(request.method)) {
      response.writeHead(405, { Allow: 'GET, HEAD' })
      response.end()
      return
    }
    const etag = '"' + createHash('sha256').update(body).digest('hex') + '"'
    response.setHeader('ETag', etag)
    response.setHeader('Cache-Control', 'private, no-cache')
    const offered = String(request.headers['if-none-match'] ?? '')
      .split(',')
      .map((x) => x.trim())
    const matches = offered.some(
      (value) => value === '*' || value.replace(/^W\//, '') === etag,
    )
    if (matches) {
      response.writeHead(304)
      response.end()
      return
    }
    response.setHeader('Content-Type', 'application/json; charset=utf-8')
    response.end(request.method === 'HEAD' ? undefined : body)
  })
  return {
    server,
    update: () => {
      body = JSON.stringify({ version: 2, title: 'Fixture revisado' })
    },
  }
}
