import { execFileSync } from 'node:child_process'
import { readdir, mkdir, writeFile } from 'node:fs/promises'

async function collect(directory) {
  const paths = []
  for (const item of (await readdir(directory, { withFileTypes: true })).sort((a, b) =>
    a.name.localeCompare(b.name),
  )) {
    if (item.name.startsWith('.') || item.name === 'node_modules') continue
    const path = `${directory}/${item.name}`
    if (item.isDirectory()) paths.push(...(await collect(path)))
    else if (item.isFile()) paths.push(path.replace(/^examples\//, ''))
  }
  return paths
}
const paths = await collect('examples/servicios-fiables')
await mkdir('public/assets/examples', { recursive: true })
const output = new URL(
  '../public/assets/examples/servicios-fiables-lab.zip',
  import.meta.url,
).pathname
execFileSync('zip', ['-q', '-X', '-FS', output, ...paths], { cwd: 'examples' })
await writeFile(
  'assets/reliable-services/download-manifest.json',
  JSON.stringify({ paths }, null, 2) + '\n',
)
console.log(`ZIP: ${paths.length} archivos`)
