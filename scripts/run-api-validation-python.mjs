import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
const directory = resolve('examples/api-validacion-errores')
const runtime = JSON.parse(await readFile(`${directory}/runtime.json`, 'utf8'))
execFileSync(
  'docker',
  [
    'run',
    '--rm',
    '--pull=never',
    '--network=none',
    '--read-only',
    '--user',
    '1000:1000',
    '--cpus',
    '1',
    '--memory',
    '512m',
    '--tmpfs',
    '/tmp:rw,size=64m',
    '--mount',
    `type=bind,src=${directory},dst=/work,readonly`,
    '--workdir',
    '/work',
    '--entrypoint',
    'python',
    runtime.image,
    '-B',
    '-m',
    'unittest',
    'discover',
    '-s',
    'tests',
    '-p',
    'test_*.py',
    '-v',
  ],
  { stdio: 'inherit' },
)
