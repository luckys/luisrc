import { execFileSync } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'

const result = JSON.parse(
  execFileSync('python3', ['experiments.py'], {
    cwd: 'examples/matematicas-estadistica',
    encoding: 'utf8',
  }),
)
await mkdir('examples/matematicas-estadistica/results', { recursive: true })
await writeFile(
  'examples/matematicas-estadistica/results/calculations.json',
  JSON.stringify(result, null, 2) + '\n',
)
console.log(`Python ${result.python}; datos ${result.data}; semilla ${result.seed}`)
