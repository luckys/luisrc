import { createServer } from 'node:http'
import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createCursor, parsePage, InputError } from './pagination.mjs'
import { formatOrder } from './representations.mjs'
import { firstPageSQL, nextPageSQL } from './queries.mjs'

const migration = readFileSync(new URL('./migration.html', import.meta.url), 'utf8')
export function createApi({ pool, change = 'additive', cursorKey = randomBytes(32) }) {
  const cursors = createCursor(cursorKey)
  return createServer(async (request, response) => {
    try {
      if (request.url.length > 4096) throw new InputError('invalid_query')
      const url = new URL(request.url, 'http://127.0.0.1')
      if (request.method === 'GET' && url.pathname === '/migration/v2') {
        response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        response.end(migration)
        return
      }
      const match = /^\/(v1|v2)\/orders$/.exec(url.pathname)
      if (!match) {
        response.writeHead(404)
        response.end()
        return
      }
      if (request.method !== 'GET') {
        response.writeHead(405, { Allow: 'GET' })
        response.end()
        return
      }
      const version = match[1]
      const { pageSize, status, after } = parsePage(url.searchParams)
      // Tenant fijo ficticio. Un servicio autenticado debe derivarlo del contexto autorizado.
      const tenant = 1
      const scope = `${version}:${tenant}:${status}`
      const cursor = after === null ? null : cursors.decode(after, scope)
      const result = cursor
        ? await pool.query(nextPageSQL, [
            tenant,
            status,
            cursor.createdAt,
            cursor.id,
            pageSize + 1,
          ])
        : await pool.query(firstPageSQL, [tenant, status, pageSize + 1])
      const rows = result.rows.slice(0, pageSize)
      const nextCursor =
        result.rows.length > pageSize ? cursors.encode(rows.at(-1), scope) : null
      response.writeHead(200, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        ...(version === 'v1'
          ? {
              Deprecation: `@${Date.parse('2026-10-18T00:00:00Z') / 1000}`,
              Sunset: new Date('2027-04-18T00:00:00Z').toUTCString(),
              Link: '</migration/v2>; rel="deprecation"; type="text/html"',
            }
          : {}),
      })
      response.end(
        JSON.stringify({
          items: rows.map((row) => formatOrder(row, version, change)),
          nextCursor,
        }),
      )
    } catch (error) {
      const invalid = error instanceof InputError
      const status = invalid ? 400 : 500
      response.writeHead(status, {
        'Content-Type': 'application/problem+json',
        'Cache-Control': 'no-store',
      })
      response.end(
        JSON.stringify({
          type: 'about:blank',
          title: invalid ? 'Bad Request' : 'Internal Server Error',
          status,
        }),
      )
    }
  })
}
