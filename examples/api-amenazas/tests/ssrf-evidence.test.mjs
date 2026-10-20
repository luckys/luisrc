import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { scenarios, observeScenario } from '../observe-ssrf.mjs'

test('T05: cinco trazas archivadas del visor coinciden con nuevas peticiones HTTP reales', async () => {
  const archived = JSON.parse(
    await readFile(new URL('../ssrf-evidence.json', import.meta.url), 'utf8'),
  )
  assert.deepEqual(
    archived.observations.map((row) => row.scenario),
    scenarios,
  )
  const observed = []
  for (const scenario of scenarios) observed.push(await observeScenario(scenario))
  assert.deepEqual(observed, archived.observations)
  assert.deepEqual(
    observed.map((row) => [
      row.status,
      row.lookups,
      row.providerRequests,
      row.internalRequests,
    ]),
    [
      [200, 0, 0, 1],
      [200, 1, 1, 1],
      [502, 1, 1, 0],
      [200, 2, 0, 1],
      [200, 1, 1, 0],
    ],
  )
})
