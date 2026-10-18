import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

export function createExplorerServer() {
  const routes = new Map([
    ['/', ['explorer.html', 'text/html']],
    ['/explorer.html', ['explorer.html', 'text/html']],
    ['/explorer.mjs', ['explorer.mjs', 'text/javascript']],
    ['/model.mjs', ['model.mjs', 'text/javascript']],
    ['/steps.html', ['steps.html', 'text/html']],
    ['/steps.mjs', ['steps.mjs', 'text/javascript']],
    ['/steps-model.mjs', ['steps-model.mjs', 'text/javascript']],
  ])
  return createServer(async (request, response) => {
    const file = routes.get(new URL(request.url, 'http://127.0.0.1').pathname)
    if (!file || request.method !== 'GET') {
      response.writeHead(404).end()
      return
    }
    try {
      const bytes = await readFile(new URL(file[0], import.meta.url))
      response
        .writeHead(200, {
          'Content-Type': `${file[1]}; charset=utf-8`,
          'X-Content-Type-Options': 'nosniff',
        })
        .end(bytes)
    } catch {
      response.writeHead(500).end('No se pudo cargar el recurso local')
    }
  })
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const server = createExplorerServer()
  server.listen(0, '127.0.0.1', () =>
    console.log(`http://127.0.0.1:${server.address().port}`),
  )
  process.once('SIGINT', () => server.close())
  process.once('SIGTERM', () => server.close())
}
