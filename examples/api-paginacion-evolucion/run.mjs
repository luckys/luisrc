import { execFileSync } from 'node:child_process'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { randomUUID, createHash } from 'node:crypto'
import { once } from 'node:events'
import os from 'node:os'
import pg from 'pg'
import { benchmark, concurrentInsert } from './experiments.mjs'
import { createApi } from './server.mjs'

const directory = fileURLToPath(new URL('./', import.meta.url))
const runtime = JSON.parse(await readFile(new URL('./runtime.json', import.meta.url)))
const mode = process.argv[2] ?? 'verify'
if (!['verify', 'serve'].includes(mode)) throw new Error('Modo: verify | serve')
const name = `blog-api-pages-${randomUUID().slice(0, 8)}`
let created = false
let pool
try {
  execFileSync('docker', ['image', 'inspect', runtime.image], { stdio: 'ignore' })
  execFileSync(
    'docker',
    [
      'run',
      '--detach',
      '--rm',
      '--pull=never',
      '--name',
      name,
      '--user',
      'postgres',
      '--read-only',
      '--cap-drop=ALL',
      '--security-opt=no-new-privileges',
      '--cpus',
      String(runtime.cpus),
      '--memory',
      runtime.memory,
      '--shm-size=128m',
      '--tmpfs',
      '/var/lib/postgresql/data:rw,uid=999,gid=999',
      '--tmpfs',
      '/var/run/postgresql:rw,uid=999,gid=999',
      '--tmpfs',
      '/tmp:rw,size=64m',
      '--publish',
      '127.0.0.1::5432',
      '--env',
      'POSTGRES_USER=lab',
      '--env',
      'POSTGRES_PASSWORD=local-only-lab',
      '--env',
      'POSTGRES_DB=api_lab',
      runtime.image,
    ],
    { stdio: 'ignore' },
  )
  created = true
  const ports = JSON.parse(
    execFileSync(
      'docker',
      ['inspect', '--format', '{{json .NetworkSettings.Ports}}', name],
      { encoding: 'utf8' },
    ),
  )
  const port = Number(ports['5432/tcp'][0].HostPort)
  pool = new pg.Pool({
    host: '127.0.0.1',
    port,
    user: 'lab',
    password: 'local-only-lab',
    database: 'api_lab',
    max: 4,
  })
  let ready = false
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      await pool.query('SELECT 1')
      ready = true
      break
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
  }
  if (!ready) throw new Error('PostgreSQL no inició en diez segundos')
  console.log('PostgreSQL local preparado; creando un millón de filas ficticias...')
  await pool.query(await readFile(new URL('./schema.sql', import.meta.url), 'utf8'))
  await pool.query('VACUUM ANALYZE orders')
  if (mode === 'serve') {
    const server = createApi({ pool })
    server.listen(0, '127.0.0.1')
    await once(server, 'listening')
    console.log(`API local: http://127.0.0.1:${server.address().port}/v1/orders`)
    await new Promise((resolve) => {
      const stop = () => {
        server.closeIdleConnections()
        server.close(resolve)
      }
      process.once('SIGINT', stop)
      process.once('SIGTERM', stop)
    })
  } else {
    execFileSync(
      process.execPath,
      [
        '--test',
        'tests/unit.test.mjs',
        'tests/http.test.mjs',
        'tests/contract.test.mjs',
        'tests/model.test.mjs',
        'tests/postgres.test.mjs',
      ],
      {
        cwd: directory,
        env: { ...process.env, API_LAB_PORT: String(port) },
        stdio: 'inherit',
      },
    )
    await pool.query('VACUUM ANALYZE orders')
    const cases = []
    for (const offset of [0, 10000, 100000, 300000])
      cases.push(await benchmark(pool, 7, offset))
    const concurrent = await concurrentInsert(pool)
    const sourceHashes = Object.fromEntries(
      await Promise.all(
        ['schema.sql', 'queries.mjs', 'experiments.mjs', 'runtime.json'].map(
          async (file) => [
            file,
            createHash('sha256')
              .update(await readFile(new URL(file, import.meta.url)))
              .digest('hex'),
          ],
        ),
      ),
    )
    const result = {
      sourceHashes,
      runtime: {
        ...runtime,
        server: (await pool.query('SELECT version() AS version')).rows[0].version,
        arch: process.arch,
        platform: process.platform,
        logicalCPUs: os.cpus().length,
      },
      rows: (await pool.query('SELECT count(*)::int AS n FROM orders')).rows[0].n,
      qualifyingRows: (
        await pool.query(
          "SELECT count(*)::int AS n FROM orders WHERE tenant_id=1 AND status='paid'",
        )
      ).rows[0].n,
      protocol:
        'EXPLAIN ANALYZE BUFFERS, caliente, siete muestras alternadas; límite 50; ancla ya conocida, coste de localizarla excluido; sin escrituras durante timings',
      cases,
      concurrent,
    }
    await mkdir(new URL('./results/', import.meta.url), { recursive: true })
    await writeFile(
      new URL('./results/experiments.json', import.meta.url),
      JSON.stringify(result, null, 2) + '\n',
    )
    console.log('Resultados guardados en results/experiments.json')
  }
} finally {
  await pool?.end()
  // Solo el contenedor privado creado en esta ejecución; nunca servicios o volúmenes ajenos.
  if (created) execFileSync('docker', ['rm', '--force', name], { stdio: 'ignore' })
}
