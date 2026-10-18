import { readFile, copyFile, mkdir } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import path from 'node:path'

const source = 'examples/estructuras-algoritmos'
const files = JSON.parse(
  await readFile('assets/algorithms-series/download-manifest.json', 'utf8'),
)
const destination = 'public/assets/interactive/algorithms-series'
await mkdir(destination, { recursive: true })
for (const file of [
  'explorer.html',
  'explorer.mjs',
  'model.mjs',
  'steps.html',
  'steps.mjs',
  'steps-model.mjs',
])
  await copyFile(`${source}/${file}`, `${destination}/${file}`)
await mkdir('public/assets/examples', { recursive: true })
const archive = path.resolve('public/assets/examples/estructuras-algoritmos-lab.zip')
execFileSync('zip', ['-X', '-FS', archive, ...files], { cwd: source, stdio: 'inherit' })
