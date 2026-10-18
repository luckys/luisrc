import { execFileSync } from 'node:child_process'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

// La imagen debe existir localmente: nunca instalar o descargar implícitamente.
const directory = resolve('examples/machine-learning')
const runtime = JSON.parse(await readFile(`${directory}/runtime.json`, 'utf8'))
const mode = process.argv[2] ?? 'tests'
const commands = {
  tests: ['-B', '-m', 'unittest', 'discover', '-s', 'tests', '-v'],
  results: ['-B', 'experiments.py'],
  data: [
    '-B',
    '-c',
    'from data import generate; print(generate().to_csv(index=False), end="")',
  ],
}
if (!(mode in commands)) throw new Error('Modo: tests | results | data')
const output = execFileSync(
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
  { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 },
)
if (mode === 'tests') process.stdout.write(output)
else {
  const relative = mode === 'data' ? 'data/logistics-v1.csv' : 'results/experiments.json'
  const path = `${directory}/${relative}`
  await mkdir(resolve(path, '..'), { recursive: true })
  if (mode === 'results') JSON.parse(output)
  await writeFile(path, output)
  console.log(`Generado ${path}`)
}
