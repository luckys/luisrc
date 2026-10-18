import { readFile, mkdir } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
const files = JSON.parse(
  await readFile('assets/api-contracts/download-manifest.json', 'utf8'),
)
await mkdir('public/assets/examples', { recursive: true })
execFileSync(
  'zip',
  ['-X', '-FS', path.resolve('public/assets/examples/api-contratos-lab.zip'), ...files],
  { cwd: 'examples/api-contratos', stdio: 'inherit' },
)
