import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { scenarios, observeScenario } from './observe-ssrf.mjs'
const observations = []
for (const scenario of scenarios) observations.push(await observeScenario(scenario))
assert.deepEqual(
  observations.map((row) => [
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
await writeFile(
  new URL('ssrf-evidence.json', import.meta.url),
  JSON.stringify(
    {
      runtime: process.version,
      scope:
        'HTTP real de fixtures loopback; resolver programado, no servidor DNS externo; no benchmark ni firewall',
      observations,
    },
    null,
    2,
  ) + '\n',
)
console.log('Cinco escenarios observados y contrastados; ssrf-evidence.json actualizado.')
