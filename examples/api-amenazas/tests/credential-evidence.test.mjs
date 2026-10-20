import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { observeRotation } from '../observe-credentials.mjs'

test('T07: evidencia archivada reproduce cinco etapas HTTP sin tokens o identificadores secretos', async () => {
  const actual = await observeRotation()
  const archived = JSON.parse(
    await readFile(new URL('../credential-evidence.json', import.meta.url), 'utf8'),
  )
  assert.deepEqual(actual, archived)
  assert.deepEqual(
    actual.observations.map(({ stage, old, next, client }) => [stage, old, next, client]),
    [
      ['initial', 200, null, 200],
      ['overlap', 200, 200, 200],
      ['reloaded', 200, 200, 200],
      ['revoked', 401, 200, 200],
      ['expired', 401, 401, 401],
    ],
  )
  assert.deepEqual(actual.events, [
    { event: 'secret_loaded', version: 'v1' },
    { event: 'secret_loaded', version: 'v2' },
  ])
  assert.ok(!/lab1\.|Bearer|digest|token|127\.0\.0\.1/.test(JSON.stringify(actual)))
})
