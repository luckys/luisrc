import { mkdir, writeFile } from 'node:fs/promises'
import { run } from '../examples/computacion-redes/experiments.mjs'

await mkdir('examples/computacion-redes/results', { recursive: true })
await writeFile(
  'examples/computacion-redes/results/experiments.json',
  JSON.stringify(await run(), null, 2) + '\n',
)
console.log(
  'Guardadas muestras y observaciones; no sustituirlas para ocultar una regresión',
)
