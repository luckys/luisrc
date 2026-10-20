import { createServer } from 'node:http'
import { once } from 'node:events'

export function fixedResolver(onEvent = () => {}) {
  let calls = 0
  return {
    get calls() {
      return calls
    },
    resolve: async (hostname) => {
      if (hostname !== 'media.fixture.test') throw new Error('Unknown fixture hostname')
      calls++
      onEvent({ kind: 'lookup', address: '127.0.0.1' })
      return [{ address: '127.0.0.1', family: 4 }]
    },
  }
}

export function changingResolver(onEvent = () => {}) {
  let calls = 0
  return {
    get calls() {
      return calls
    },
    resolve: async (hostname) => {
      if (hostname !== 'media.fixture.test') throw new Error('Unknown fixture hostname')
      calls++
      onEvent({ kind: 'lookup', address: calls === 1 ? '127.0.0.1' : '127.0.0.2' })
      return [{ address: calls === 1 ? '127.0.0.1' : '127.0.0.2', family: 4 }]
    },
  }
}

export async function startDestinations({ onEvent = () => {} } = {}) {
  const metrics = { provider: [], internal: [] }
  const record = (request) => ({
    path: request.url,
    host: request.headers.host,
    hasAuthorization: Boolean(request.headers.authorization),
    hasCookie: Boolean(request.headers.cookie),
    remoteAddress: request.socket.remoteAddress,
    localAddress: request.socket.localAddress,
  })
  let internalOrigin
  const provider = createServer((request, response) => {
    metrics.provider.push(record(request))
    onEvent({ kind: 'request', destination: 'provider' })
    response.setHeader('content-type', 'text/plain; charset=utf-8')
    if (request.url === '/redirect') {
      response.writeHead(302, { location: internalOrigin + '/marker' })
      return response.end('redirect')
    }
    if (request.url === '/large') return response.end('x'.repeat(2048))
    if (request.url === '/silent') return
    const values = { '/asset/north/a1': 'NORTH-A1', '/asset/south/b1': 'SOUTH-B1' }
    if (!Object.hasOwn(values, request.url)) response.statusCode = 404
    response.end(values[request.url] ?? 'MISSING')
  })
  const internal = createServer((request, response) => {
    metrics.internal.push(record(request))
    onEvent({ kind: 'request', destination: 'internal' })
    response.setHeader('content-type', 'text/plain; charset=utf-8')
    response.end('INTERNAL-MARKER')
  })
  const close = async () => {
    await Promise.all(
      [provider, internal].map(
        (server) =>
          new Promise((resolve, reject) => {
            server.closeAllConnections()
            server.close((error) =>
              error && error.code !== 'ERR_SERVER_NOT_RUNNING'
                ? reject(error)
                : resolve(),
            )
          }),
      ),
    )
  }
  try {
    provider.listen(0, '127.0.0.1')
    await once(provider, 'listening')
    const port = provider.address().port
    internalOrigin = `http://127.0.0.2:${port}`
    internal.listen(port, '127.0.0.2')
    await once(internal, 'listening')
    return {
      providerOrigin: `http://media.fixture.test:${port}`,
      internalOrigin,
      metrics,
      close,
    }
  } catch (error) {
    await close()
    throw error
  }
}
