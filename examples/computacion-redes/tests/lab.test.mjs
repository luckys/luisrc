import test from 'node:test'
import assert from 'node:assert/strict'
import {
  checksum,
  cacheTrace,
  traces,
  minorUnits,
  representation,
  transport,
} from '../concepts.mjs'
import {
  memoryExperiment,
  processExperiment,
  linuxExperiment,
  dnsExperiment,
  tlsExperiment,
  httpExperiment,
} from '../experiments.mjs'

test('P001: checksum conserva todos los bytes y orden no altera la suma', () => {
  assert.equal(checksum(Uint8Array.of(0, 1, 127, 255)), 383)
  assert.equal(checksum(Uint8Array.of(255, 127, 1, 0)), 383)
})
test('P001: localidad cambia misses en el modelo, no la cantidad de accesos', () => {
  const { sequential, blocked } = traces()
  assert.equal(sequential.length, 128)
  assert.equal(blocked.length, 128)
  assert.equal(cacheTrace(sequential).misses, 32)
  assert.equal(cacheTrace(blocked).misses, 8)
  assert.throws(() => cacheTrace([-1]))
})
test('P001: lectura y proceso producen igual checksum con nueve muestras', async () => {
  const result = await memoryExperiment()
  assert.equal(result.samples.length, 9)
  assert.ok(result.samples.every((row) => row.memory_sum === row.file_sum))
  assert.ok(result.samples.every((row) => row.memory_ms >= 0 && row.file_ms >= 0))
})
test('P002: cantidades exactas no pasan por Number', () => {
  assert.equal(minorUnits('0.10') + minorUnits('0.20'), 30n)
  assert.equal(minorUnits('9007199254740993.01'), 900719925474099301n)
  for (const invalid of ['1.001', '1,00', '-1.00', 'NaN'])
    assert.throws(() => minorUnits(invalid))
})
test('P002: se reproducen float y UTF-8 incompleto con corrección streaming', () => {
  const row = representation()
  assert.equal(row.float_sum, 0.30000000000000004)
  assert.equal(row.text, 'España')
  assert.equal(row.bytes, 7)
  assert.equal(row.streaming, 'ñ')
  assert.equal(row.truncated_rejected, true)
  assert.equal(row.same_instant, true)
})
test('P003: proceso hijo observa bloqueo y mantiene buffer fuera del heap JS', () => {
  const row = processExperiment()
  assert.deepEqual(row.events, ['busy:start', 'busy:end', 'timer'])
  assert.ok(row.pid > 0)
  assert.ok(row.cpu_user_us + row.cpu_system_us > 0)
  assert.ok(row.after.arrayBuffers - row.before.arrayBuffers >= 8 * 1024 * 1024)
})
test('P004: servicio propio responde, aparece en ps/ss y cierra con SIGTERM', async () => {
  const row = await linuxExperiment()
  assert.equal(row.status, 200)
  assert.equal(row.pid_observed, true)
  assert.equal(row.port_observed, true)
  assert.equal(row.exit_code, 0)
  assert.ok(row.events.includes('shutdown'))
})
test('P005: resolver real consulta únicamente DNS local del fixture', async () => {
  const row = await dnsExperiment()
  assert.deepEqual(row.answers, [{ address: '127.0.0.1', ttl: 30 }])
  assert.equal(row.queries, 2)
  assert.equal(row.route_loopback, true)
  assert.equal(row.connection_status, 200)
  assert.equal(row.resource_version, 1)
})
test('P006: pérdida no bloquea datagramas posteriores; entrega ordenada espera', () => {
  const ordered = transport({ mode: 'ordered' })
  const datagram = transport({ mode: 'datagram' })
  assert.equal(ordered[1].delivered, 160)
  assert.equal(ordered[2].delivered, 160)
  assert.equal(datagram[1].delivered, null)
  assert.equal(datagram[2].delivered, 80)
  assert.equal(ordered.filter((x) => x.late).length, 3)
  assert.equal(datagram.filter((x) => x.delivered !== null && !x.late).length, 5)
})
test('P006: sin pérdida ambos modelos conservan tiempos', () => {
  const a = transport({ mode: 'ordered', lost: -1 })
  const b = transport({ mode: 'datagram', lost: -1 })
  assert.deepEqual(a, b)
  assert.throws(() => transport({ mode: 'unknown' }))
})
test('P007: TLS rechaza emisor desconocido y nombre incorrecto; acepta trust local', async () => {
  const row = await tlsExperiment()
  assert.equal(row.untrusted, 'DEPTH_ZERO_SELF_SIGNED_CERT')
  assert.equal(row.wrong_name, 'ERR_TLS_CERT_ALTNAME_INVALID')
  assert.equal(row.trusted.authorized, true)
  assert.equal(row.trusted.subject, 'localhost')
  assert.ok(row.trusted.protocol.startsWith('TLSv1.'))
})
test('P008: ETag devuelve 200, después 304 vacío y 200 tras cambiar contenido', async () => {
  const row = await httpExperiment()
  assert.deepEqual(row.statuses, [200, 304, 200])
  assert.equal(row.not_modified_bytes, 0)
  assert.notEqual(row.etags[0], row.etags[1])
})
