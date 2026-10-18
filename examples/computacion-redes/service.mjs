import { createServer } from 'node:http'

const log = (event) =>
  process.stdout.write(JSON.stringify({ event, pid: process.pid }) + '\n')
const server = createServer((request, response) => {
  log('request')
  response.setHeader('Content-Type', 'application/json')
  response.end(JSON.stringify({ message: process.env.LAB_MESSAGE ?? 'fixture' }))
})
server.listen(0, '127.0.0.1', () => {
  log('ready')
  const ready = { pid: process.pid, port: server.address().port }
  if (process.send) process.send(ready)
  else console.log(JSON.stringify(ready))
})
process.on('SIGTERM', () => {
  log('shutdown')
  server.close(() => process.exit(0))
  server.closeIdleConnections()
})
