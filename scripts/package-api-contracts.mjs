import { readFile, mkdir } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
await mkdir('public/assets/examples', { recursive: true })
for (const [manifest, directory, archive] of [
  ['download-manifest.json', 'api-contratos', 'api-contratos-lab.zip'],
  [
    'validation-download-manifest.json',
    'api-validacion-errores',
    'api-validacion-errores-lab.zip',
  ],
]) {
  const files = JSON.parse(await readFile(`assets/api-contracts/${manifest}`, 'utf8'))
  execFileSync(
    'zip',
    ['-X', '-FS', path.resolve(`public/assets/examples/${archive}`), ...files],
    { cwd: `examples/${directory}`, stdio: 'inherit' },
  )
}
