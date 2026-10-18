import { readFile, readdir, writeFile, mkdir, copyFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'

const interactive = 'public/assets/interactive/computing-series'
await mkdir(interactive, { recursive: true })
for (const filename of ['transport.html', 'transport-ui.mjs', 'concepts.mjs'])
  await copyFile(`examples/computacion-redes/${filename}`, `${interactive}/${filename}`)
async function collect(directory) {
  const paths = []
  for (const item of (await readdir(directory, { withFileTypes: true })).sort((a, b) =>
    a.name.localeCompare(b.name),
  )) {
    if (
      item.name.startsWith('.') ||
      item.name === 'node_modules' ||
      item.name === '__pycache__' ||
      item.name.endsWith('.pyc')
    )
      continue
    const path = `${directory}/${item.name}`
    if (item.isDirectory()) paths.push(...(await collect(path)))
    else if (item.isFile()) paths.push(path.replace(/^examples\//, ''))
  }
  return paths
}
const paths = await collect('examples/computacion-redes')
if (paths.some((path) => /\.pem$|\.key$/.test(path)))
  throw new Error('No empaquetar claves o certificados temporales')
await mkdir('public/assets/examples', { recursive: true })
execFileSync(
  'zip',
  [
    '-q',
    '-X',
    '-FS',
    new URL('../public/assets/examples/computacion-redes-lab.zip', import.meta.url)
      .pathname,
    ...paths,
  ],
  { cwd: 'examples' },
)
await writeFile(
  'assets/computing-series/download-manifest.json',
  JSON.stringify({ paths }, null, 2) + '\n',
)
console.log(`ZIP: ${paths.length} archivos`)
