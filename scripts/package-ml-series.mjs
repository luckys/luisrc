import { execFileSync } from 'node:child_process'
import { readdir, writeFile, mkdir, readFile, copyFile } from 'node:fs/promises'

async function collect(directory) {
  const paths = []
  for (const item of (await readdir(directory, { withFileTypes: true })).sort((a, b) =>
    a.name.localeCompare(b.name),
  )) {
    if (
      item.name.startsWith('.') ||
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
const interactive = 'public/assets/interactive/ml-series'
await mkdir(interactive, { recursive: true })
for (const filename of ['explorer.html', 'explorer.mjs'])
  await copyFile(`examples/machine-learning/${filename}`, `${interactive}/${filename}`)
const result = JSON.parse(
  await readFile('examples/machine-learning/results/experiments.json', 'utf8'),
)
await writeFile(
  `${interactive}/validation.json`,
  JSON.stringify(result.validation_predictions) + '\n',
)
// El HTML usa la misma ruta relativa en el ZIP y en el recurso público.
await copyFile(
  `${interactive}/validation.json`,
  'examples/machine-learning/validation.json',
)
const completePaths = await collect('examples/machine-learning')
await mkdir('public/assets/examples', { recursive: true })
execFileSync(
  'zip',
  [
    '-q',
    '-X',
    '-FS',
    new URL('../public/assets/examples/machine-learning-lab.zip', import.meta.url)
      .pathname,
    ...completePaths,
  ],
  { cwd: 'examples' },
)
await writeFile(
  'assets/ml-series/download-manifest.json',
  JSON.stringify({ paths: completePaths }, null, 2) + '\n',
)
console.log(`ZIP: ${completePaths.length} archivos`)
