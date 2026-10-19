import { createServer } from 'node:http'
import { createApp } from './server.mjs'
import { createFixtures } from './fixtures.mjs'

const server = createServer(
  { requestTimeout: 5000, headersTimeout: 5000 },
  createApp(createFixtures()),
)
server.listen(0, '127.0.0.1', () => {
  console.log(`Laboratorio local: http://127.0.0.1:${server.address().port}`)
  console.log(
    'Solo fixtures públicas, p. ej. Authorization: Bearer alice-demo. No usar datos reales.',
  )
})
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => {
    server.close()
    server.closeAllConnections()
  })
