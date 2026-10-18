import assert from 'node:assert/strict'
import { performance } from 'node:perf_hooks'
import os from 'node:os'
import { pathToFileURL } from 'node:url'
import { linearSearch, buildIndex } from './algorithms.ts'
import { workload, comparisonModel } from './model.mjs'

export const median = (values) =>
  [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]

export function measure(n, q, pattern) {
  const { rows, queries } = workload(n, q, pattern)
  const reference = buildIndex(rows)
  const expected = queries.reduce((sum, id) => sum + (reference.get(id)?.id ?? -1), 0)
  const scan = () =>
    queries.reduce((sum, id) => sum + (linearSearch(rows, id)?.id ?? -1), 0)
  const indexed = () =>
    queries.reduce((sum, id) => sum + (reference.get(id)?.id ?? -1), 0)
  const fresh = () => {
    const index = buildIndex(rows)
    return queries.reduce((sum, id) => sum + (index.get(id)?.id ?? -1), 0)
  }
  const operations = { scan, indexed, fresh }
  for (let i = 0; i < 5; i++)
    for (const operation of Object.values(operations)) assert.equal(operation(), expected)
  const samples = []
  for (let sample = 0; sample < 9; sample++) {
    const order = ['scan', 'indexed', 'fresh']
    order.push(...order.splice(0, sample % order.length))
    const row = { sample: sample + 1, order }
    for (const key of order) {
      const start = performance.now()
      const checksum = operations[key]()
      row[`${key}_ms`] = performance.now() - start
      assert.equal(checksum, expected)
    }
    samples.push(row)
  }
  return {
    n,
    q,
    pattern,
    checksum: expected,
    counts: comparisonModel(n, q, pattern),
    samples,
    medians_ms: Object.fromEntries(
      Object.keys(operations).map((key) => [
        key,
        median(samples.map((row) => row[`${key}_ms`])),
      ]),
    ),
  }
}

export function run() {
  return {
    environment: {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      kernel: os.release(),
      cpu: os.cpus()[0]?.model,
      logicalCPUs: os.cpus().length,
    },
    method: {
      warmups: 5,
      samples: 9,
      queriesPerBatch: 200,
      seed: 'fórmula fija (i * 7919 + 17) % n',
      timing: 'ms por lote; fresh incluye construcción y consultas',
      patterns: ['first', 'last', 'miss', 'mixed'],
    },
    cases: [1000, 5000, 20000].flatMap((n) =>
      ['first', 'last', 'miss', 'mixed'].map((pattern) => measure(n, 200, pattern)),
    ),
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  console.log(JSON.stringify(run(), null, 2))
