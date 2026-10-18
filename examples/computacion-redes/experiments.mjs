import { mkdtemp, writeFile, readFile, unlink, rmdir, stat } from 'node:fs/promises'
import { tmpdir, cpus, release } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { performance } from 'node:perf_hooks'
import { execFileSync, spawn } from 'node:child_process'
import { once } from 'node:events'
import dgram from 'node:dgram'
import { Resolver } from 'node:dns/promises'
import tls from 'node:tls'
import { checksum, cacheTrace, traces, representation, transport } from './concepts.mjs'
import { resourceServer } from './http-server.mjs'

const directory = fileURLToPath(new URL('.', import.meta.url))
const listen = async (server) => {
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  return server.address().port
}
const close = (server) =>
  new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()))
    server.closeIdleConnections?.()
  })

export async function memoryExperiment() {
  const folder = await mkdtemp(join(tmpdir(), 'computing-memory-'))
  const path = join(folder, 'fixture.bin')
  const bytes = Buffer.alloc(2 * 1024 * 1024)
  for (let i = 0; i < bytes.length; i++) bytes[i] = i % 251
  await writeFile(path, bytes, { mode: 0o640 })
  const expected = checksum(bytes)
  async function measure(operation) {
    const start = performance.now()
    const sum = await operation()
    if (sum !== expected) throw new Error('Checksum diferente')
    return { ms: performance.now() - start, sum }
  }
  try {
    for (let i = 0; i < 3; i++) {
      checksum(bytes)
      checksum(await readFile(path))
    }
    const samples = []
    for (let i = 0; i < 9; i++) {
      let memory, file
      if (i % 2 === 0) {
        memory = await measure(() => checksum(bytes))
        file = await measure(async () => checksum(await readFile(path)))
      } else {
        file = await measure(async () => checksum(await readFile(path)))
        memory = await measure(() => checksum(bytes))
      }
      samples.push({
        memory_ms: memory.ms,
        file_ms: file.ms,
        memory_sum: memory.sum,
        file_sum: file.sum,
      })
    }
    const median = (key) => [...samples.map((x) => x[key])].sort((a, b) => a - b)[4]
    return {
      size_bytes: bytes.length,
      checksum: expected,
      samples,
      median_memory_ms: median('memory_ms'),
      median_file_ms: median('file_ms'),
      mode: (await stat(path)).mode & 0o777,
      cache_state:
        'Warm-up y fichero recién escrito: page cache probable, no lectura física aislada',
    }
  } finally {
    await unlink(path)
    await rmdir(folder)
  }
}

export function processExperiment() {
  return JSON.parse(
    execFileSync(process.execPath, ['process-probe.mjs'], {
      cwd: directory,
      encoding: 'utf8',
      timeout: 5000,
    }),
  )
}

export async function linuxExperiment() {
  const child = spawn(process.execPath, ['service.mjs'], {
    cwd: directory,
    env: { ...process.env, LAB_MESSAGE: 'fixture' },
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
  })
  const done = once(child, 'close')
  let stdout = ''
  child.stdout.on('data', (chunk) => {
    stdout += chunk
  })
  const watchdog = setTimeout(() => child.kill('SIGKILL'), 5000)
  try {
    const [ready] = await Promise.race([
      once(child, 'message'),
      done.then(() => {
        throw new Error('El servicio terminó antes de estar listo')
      }),
    ])
    const ps = execFileSync('ps', ['-p', String(ready.pid), '-o', 'pid=,stat=,comm='], {
      encoding: 'utf8',
    })
    const ss = execFileSync('ss', ['-ltnp', `sport = :${ready.port}`], {
      encoding: 'utf8',
    })
    const response = await fetch(`http://127.0.0.1:${ready.port}`, {
      signal: AbortSignal.timeout(2000),
    })
    await response.text()
    child.kill('SIGTERM') // El handle corresponde exclusivamente al hijo creado aquí.
    const [code] = await done
    return {
      pid_observed: ps.trim().startsWith(String(ready.pid)),
      port_observed: ss.includes(`127.0.0.1:${ready.port}`),
      status: response.status,
      exit_code: code,
      events: stdout
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line).event),
    }
  } finally {
    clearTimeout(watchdog)
    if (child.exitCode === null && child.signalCode === null) {
      child.kill('SIGKILL')
      await done
    }
  }
}

// Solo preguntas A/IN sin compresión para lab.test; no es un servidor DNS general.
function answer(query) {
  if (query.length < 17 || query.readUInt16BE(4) !== 1) return null
  let offset = 12
  const labels = []
  while (offset < query.length && query[offset] !== 0) {
    const length = query[offset++]
    if (length > 63 || offset + length >= query.length) return null
    labels.push(query.toString('ascii', offset, offset + length))
    offset += length
  }
  offset++
  if (
    offset + 4 > query.length ||
    query.readUInt16BE(offset) !== 1 ||
    query.readUInt16BE(offset + 2) !== 1
  )
    return null
  const found = labels.join('.') === 'lab.test'
  const header = Buffer.alloc(12)
  header.writeUInt16BE(query.readUInt16BE(0), 0)
  header.writeUInt16BE(found ? 0x8580 : 0x8583, 2)
  header.writeUInt16BE(1, 4)
  header.writeUInt16BE(found ? 1 : 0, 6)
  const record = Buffer.from([0xc0, 0x0c, 0, 1, 0, 1, 0, 0, 0, 30, 0, 4, 127, 0, 0, 1])
  return Buffer.concat([
    header,
    query.subarray(12, offset + 4),
    ...(found ? [record] : []),
  ])
}

export async function dnsExperiment() {
  const server = dgram.createSocket('udp4')
  let queries = 0
  server.on('message', (query, remote) => {
    queries++
    const response = answer(query)
    if (response) server.send(response, remote.port, remote.address)
  })
  server.bind(0, '127.0.0.1')
  await once(server, 'listening')
  const resolver = new Resolver({ timeout: 500, tries: 1 })
  resolver.setServers([`127.0.0.1:${server.address().port}`])
  let httpServer
  try {
    const answers = await resolver.resolve4('lab.test', { ttl: true })
    await resolver.resolve4('lab.test', { ttl: true })
    const route = execFileSync('ip', ['route', 'get', '127.0.0.1'], { encoding: 'utf8' })
    httpServer = resourceServer().server
    const port = await listen(httpServer)
    const response = await fetch(`http://${answers[0].address}:${port}/resource`, {
      signal: AbortSignal.timeout(2000),
    })
    const resource = await response.json()
    return {
      answers,
      queries,
      route_loopback: /dev lo\b/.test(route),
      connection_status: response.status,
      resource_version: resource.version,
    }
  } finally {
    resolver.cancel()
    await new Promise((resolve) => server.close(resolve))
    if (httpServer?.listening) await close(httpServer)
  }
}

export async function tlsExperiment() {
  const folder = await mkdtemp(join(tmpdir(), 'computing-tls-'))
  const keyPath = join(folder, 'key.pem'),
    certPath = join(folder, 'cert.pem')
  let server
  try {
    execFileSync(
      'openssl',
      [
        'req',
        '-x509',
        '-newkey',
        'rsa:2048',
        '-nodes',
        '-keyout',
        keyPath,
        '-out',
        certPath,
        '-days',
        '1',
        '-subj',
        '/CN=localhost',
        '-addext',
        'subjectAltName=DNS:localhost',
      ],
      { stdio: 'ignore', timeout: 10000 },
    )
    const cert = await readFile(certPath)
    server = tls.createServer({ key: await readFile(keyPath), cert }, (socket) =>
      socket.end('fixture'),
    )
    server.on('tlsClientError', () => {}) // Las dos conexiones rechazadas son casos de prueba.
    const port = await listen(server)
    const connect = (options) =>
      new Promise((resolve) => {
        const socket = tls.connect({
          host: '127.0.0.1',
          port,
          servername: 'localhost',
          rejectUnauthorized: true,
          ...options,
        })
        socket.setTimeout(2000, () => socket.destroy(new Error('Timeout local TLS')))
        socket.once('error', (error) => resolve(error.code ?? error.message))
        socket.once('secureConnect', () => {
          const peer = socket.getPeerCertificate()
          resolve({
            authorized: socket.authorized,
            protocol: socket.getProtocol(),
            subject: peer.subject.CN,
            san: peer.subjectaltname,
            cipher: socket.getCipher().name,
          })
          socket.destroy()
        })
      })
    return {
      untrusted: await connect({}),
      wrong_name: await connect({ ca: cert, servername: 'wrong.test' }),
      trusted: await connect({ ca: cert }),
    }
  } finally {
    if (server?.listening) await close(server)
    for (const path of [keyPath, certPath])
      try {
        await unlink(path)
      } catch (error) {
        if (error.code !== 'ENOENT') throw error
      }
    await rmdir(folder)
  }
}

export async function httpExperiment() {
  const { server, update } = resourceServer()
  const port = await listen(server)
  const url = `http://127.0.0.1:${port}/resource`
  try {
    const first = await fetch(url)
    await first.text()
    const etag = first.headers.get('etag')
    const second = await fetch(url, { headers: { 'If-None-Match': etag } })
    const bytes = (await second.arrayBuffer()).byteLength
    update()
    const third = await fetch(url, { headers: { 'If-None-Match': etag } })
    await third.text()
    return {
      statuses: [first.status, second.status, third.status],
      not_modified_bytes: bytes,
      etags: [etag, third.headers.get('etag')],
    }
  } finally {
    await close(server)
  }
}

export async function run() {
  const access = traces()
  return {
    environment: {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      kernel: release(),
      cpu: cpus()[0].model,
      logical_cpus: cpus().length,
    },
    memory: await memoryExperiment(),
    cache: {
      sequential: cacheTrace(access.sequential),
      blocked: cacheTrace(access.blocked),
    },
    representation: representation(),
    process: processExperiment(),
    linux: await linuxExperiment(),
    dns: await dnsExperiment(),
    transport: { ordered: transport(), datagram: transport({ mode: 'datagram' }) },
    tls: await tlsExperiment(),
    http: await httpExperiment(),
  }
}
if (process.argv[1] === fileURLToPath(import.meta.url))
  console.log(JSON.stringify(await run(), null, 2))
