import { spawn, execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const cwd = fileURLToPath(new URL('../', import.meta.url))
const common = [
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
  'series_lab',
]
export function sqlFile(name) {
  return execFileSync(
    'docker',
    [...common, '-v', 'ON_ERROR_STOP=1', '-f', `/lab/sql/${name}`],
    { cwd, encoding: 'utf8', timeout: 60000 },
  )
}
export function sql(query) {
  return execFileSync('docker', [...common, '-v', 'ON_ERROR_STOP=1', '-c', query], {
    cwd,
    encoding: 'utf8',
    timeout: 60000,
  }).trim()
}
export function redis(...args) {
  return execFileSync(
    'docker',
    ['compose', 'exec', '-T', 'redis', 'redis-cli', '--raw', ...args],
    { cwd, encoding: 'utf8', timeout: 10000 },
  ).trim()
}

// Un cliente por sesión. El marcador separa respuestas sin usar pausas arbitrarias.
export function session() {
  const child = spawn('docker', [...common, '-v', 'VERBOSITY=sqlstate'], {
    cwd,
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  let output = '',
    errors = '',
    active,
    serial = 0
  child.stdout.on('data', (chunk) => {
    output += chunk
    finish()
  })
  child.stderr.on('data', (chunk) => {
    errors += chunk
  })
  child.on('error', (error) => active?.reject(error))
  child.on('exit', (code) => {
    if (active) active.reject(new Error(`psql terminó: ${code}; ${errors}`))
  })
  function finish() {
    if (!active || !output.includes(active.marker)) return
    const current = active
    clearTimeout(current.timer)
    active = undefined
    const result = output.slice(0, output.indexOf(current.marker)).trim()
    output = output
      .slice(output.indexOf(current.marker) + current.marker.length)
      .trimStart()
    // stderr y stdout son pipes distintos; el marcador no ordena sus eventos.
    // Los errores SQL se capturan mediante SQLSTATE de psql en stdout.
    if (result.includes('SQLSTATE:')) {
      const [body, state] = result.split('SQLSTATE:')
      if (!state.trim().startsWith('00000'))
        return current.reject(new Error(`SQLSTATE ${state.trim()}: ${errors}`))
      return current.resolve(body.trim())
    }
    current.resolve(result)
  }
  return {
    query(query) {
      if (active)
        throw new Error('No se permiten consultas simultáneas en la misma sesión')
      errors = ''
      const marker = `END_QUERY_${++serial}`
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          child.kill('SIGKILL')
          reject(new Error(`Timeout SQL: ${query}`))
        }, 15000)
        active = { marker, resolve, reject, timer }
        child.stdin.write(`${query};\n\\echo SQLSTATE: :SQLSTATE\n\\echo ${marker}\n`)
      })
    },
    close() {
      return new Promise((resolve) => {
        child.once('exit', resolve)
        child.stdin.end('ROLLBACK;\n\\q\n')
      })
    },
  }
}
