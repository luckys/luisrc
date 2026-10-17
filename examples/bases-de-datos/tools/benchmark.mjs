import { mkdir, writeFile } from 'node:fs/promises'
import { sql, sqlFile } from './database.mjs'

sqlFile('07-indices.sql')
sql('DROP INDEX db_perf.events_tenant')
const query = 'SELECT id FROM db_perf.events WHERE tenant_id=42'
function plan() {
  return JSON.parse(sql(`EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) ${query}`))[0]
}
function measure() {
  plan() // Calentamiento fuera de las muestras.
  const samples = Array.from({ length: 7 }, plan)
  const times = samples.map((p) => p['Execution Time']).sort((a, b) => a - b)
  return { median_ms: times[3], times_ms: times, plan: samples[3] }
}
const without = measure()
sql('CREATE INDEX events_tenant ON db_perf.events(tenant_id)')
const withIndex = measure()
// EXPLAIN WAL mide registros/bytes generados, no durabilidad ni latencia de disco.
function insertPlan(table) {
  return JSON.parse(
    sql(
      `EXPLAIN (ANALYZE,WAL,FORMAT JSON) INSERT INTO ${table} SELECT n,repeat('x',100) FROM generate_series(1,10000) n`,
    ),
  )[0]
}
sql(
  'CREATE TABLE db_perf.write_plain(id integer,payload text); CREATE TABLE db_perf.write_indexed(LIKE db_perf.write_plain); CREATE INDEX write_indexed_id ON db_perf.write_indexed(id)',
)
const plain = insertPlan('db_perf.write_plain'),
  indexed = insertPlan('db_perf.write_indexed')
const result = {
  generated_at: new Date().toISOString(),
  postgres: sql('SHOW server_version'),
  settings: {
    shared_buffers: sql('SHOW shared_buffers'),
    work_mem: sql('SHOW work_mem'),
  },
  rows: 100000,
  matching: 100,
  samples: 7,
  without_index: without,
  with_index: withIndex,
  write: { rows: 10000, plain, indexed },
  warning:
    'Experimento sintético local, sin concurrencia. Una pasada WAL por variante. No extrapolar ratios a producción.',
}
const directory = new URL('../results/', import.meta.url)
await mkdir(directory, { recursive: true })
await writeFile(
  new URL('benchmark.json', directory),
  JSON.stringify(result, null, 2) + '\n',
)
console.log(
  JSON.stringify({
    postgres: result.postgres,
    without_ms: without.median_ms,
    with_ms: withIndex.median_ms,
    plain_wal: plain.Plan['WAL Bytes'],
    indexed_wal: indexed.Plan['WAL Bytes'],
  }),
)
