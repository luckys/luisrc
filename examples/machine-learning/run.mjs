import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const directory = fileURLToPath(new URL('.', import.meta.url))
const runtime = JSON.parse(readFileSync(new URL('runtime.json', import.meta.url), 'utf8'))
const mode = process.argv[2] ?? 'tests'
const commands = {
  tests: ['-B', '-m', 'unittest', 'discover', '-s', 'tests', '-v'],
  results: ['-B', 'experiments.py'],
}
if (!(mode in commands)) throw new Error('Modo: tests | results')
execFileSync(
  'docker',
  [
    'run',
    '--rm',
    '--pull=never',
    '--network',
    'none',
    '--read-only',
    '--tmpfs',
    '/tmp',
    '--cpus',
    '2',
    '--memory',
    '2g',
    '--user',
    '1000:100',
    '--env',
    'OMP_NUM_THREADS=1',
    '--env',
    'OPENBLAS_NUM_THREADS=1',
    '--mount',
    `type=bind,src=${directory},dst=/work,readonly`,
    '--workdir',
    '/work',
    '--entrypoint',
    'python',
    runtime.image,
    ...commands[mode],
  ],
  { stdio: 'inherit' },
)
