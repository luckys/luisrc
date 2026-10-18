import { mkdir, writeFile } from 'node:fs/promises'
import { run } from '../examples/estructuras-algoritmos/benchmark.mjs'

// Recalcula explícitamente el archivo observado; el benchmark normal solo imprime.
const result = run()
await mkdir('examples/estructuras-algoritmos/results', { recursive: true })
await writeFile(
  'examples/estructuras-algoritmos/results/benchmark.json',
  JSON.stringify(result, null, 2) + '\n',
)
for (const row of result.cases) console.log(row.n, row.pattern, row.medians_ms)
