import { execFileSync, execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'

const cwd = fileURLToPath(new URL('../', import.meta.url))
const base = [
  'compose',
  'exec',
  '-T',
  'postgres',
  'psql',
  '-X',
  '-qAt',
  '-U',
  'lab',
  '-d',
  'reliable_lab',
  '-v',
  'ON_ERROR_STOP=1',
]
export function sql(query) {
  return execFileSync('docker', [...base, '-c', query], {
    cwd,
    encoding: 'utf8',
    timeout: 30000,
  }).trim()
}
export function sqlFile(name) {
  return execFileSync('docker', [...base, '-f', `/lab/sql/${name}`], {
    cwd,
    encoding: 'utf8',
    timeout: 30000,
  }).trim()
}
export async function sqlAsync(query) {
  const result = await promisify(execFile)('docker', [...base, '-c', query], {
    cwd,
    encoding: 'utf8',
    timeout: 30000,
  })
  return result.stdout.trim()
}
