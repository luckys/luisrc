import { execFileSync } from 'node:child_process'
import { mkdir, readdir, writeFile } from 'node:fs/promises'

// Solo archivos del laboratorio, enumerados para evitar cachés y datos de Docker.
async function files(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const result = []
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
    const path = `${directory}/${entry.name}`
    if (entry.isDirectory()) result.push(...(await files(path)))
    else if (entry.isFile()) result.push(path.replace(/^examples\//, ''))
  }
  return result
}
const paths = await files('examples/bases-de-datos')
await mkdir('public/assets/examples', { recursive: true })
const output = new URL(
  '../public/assets/examples/bases-de-datos-lab.zip',
  import.meta.url,
).pathname
// -FS elimina entradas antiguas del ZIP, no del árbol de archivos de trabajo.
execFileSync('zip', ['-q', '-X', '-FS', output, ...paths], { cwd: 'examples' })
const manifest = { files: paths.length, paths }
await writeFile(
  'assets/database-series/download-manifest.json',
  JSON.stringify(manifest, null, 2) + '\n',
)
console.log(`Laboratorio empaquetado: ${paths.length} archivos`)
