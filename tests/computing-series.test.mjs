import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import YAML from 'yaml'
import {
  cacheTrace,
  traces,
  representation,
  transport,
} from '../examples/computacion-redes/concepts.mjs'

const manifest = JSON.parse(
  await readFile('docs/editorial/computing-series.json', 'utf8'),
)
const results = JSON.parse(
  await readFile('examples/computacion-redes/results/experiments.json', 'utf8'),
)
const normalize = (text) => text.replace(/\s+/g, '')

test('computación: nueve drafts españoles en orden, metadatos y dependencias acíclicas', async () => {
  const seen = new Set()
  let previous = 0
  for (const [index, entry] of manifest.articles.entries()) {
    assert.equal(entry.id, `P00${index + 1}`)
    for (const prerequisite of entry.prerequisites) assert.ok(seen.has(prerequisite))
    const source = await readFile(`src/content/posts/es/${entry.slug}.md`, 'utf8')
    const header = YAML.parse(source.match(/^---\n([\s\S]*?)\n---/)[1])
    for (const key of ['id', 'slug', 'title']) assert.equal(header[key], entry[key])
    assert.equal(header.series, manifest.name)
    assert.equal(header.locale, 'es')
    assert.equal(header.author, 'Luis Ramírez Calle')
    assert.equal(header.draft, true)
    assert.equal(header.status, 'draft')
    assert.deepEqual(header.prerequisites, entry.prerequisites)
    assert.ok(new Date(header.published).valueOf() > previous)
    previous = new Date(header.published).valueOf()
    assert.ok(!/PaySafe|—/.test(source))
    for (const section of ['## Garantías y límites', '## Ejercicio:', '## Referencias'])
      assert.ok(source.includes(section), entry.id)
    assert.ok(source.includes('/assets/examples/computacion-redes-lab.zip'))
    const words = source.split(/\s+/).length
    assert.ok(words >= 850 && words < 1500, `${entry.id}: ${words}`)
    seen.add(entry.id)
  }
  assert.equal(seen.size, 9)
})

test('computación: enlaces internos y doce imágenes con alt y dimensiones reales', async () => {
  const slugs = new Set(
    (await readdir('src/content/posts/es'))
      .filter((name) => name.endsWith('.md'))
      .map((name) => name.slice(0, -3)),
  )
  let count = 0
  for (const entry of manifest.articles) {
    const body = await readFile(`src/content/posts/es/${entry.slug}.md`, 'utf8')
    for (const [, slug] of body.matchAll(/\]\(\/posts\/([^)#]+)(?:#[^)]*)?\)/g))
      assert.ok(slugs.has(slug), slug)
    for (const [, path, alt, width, height] of body.matchAll(
      /<img src="([^\"]+)" alt="([^\"]+)" width="(\d+)" height="(\d+)"/g,
    )) {
      assert.ok(alt.length > 40)
      const svg = await readFile(`public${path}`, 'utf8')
      const [, , w, h] = svg
        .match(/viewBox="([^\"]+)"/)[1]
        .split(/\s+/)
        .map(Number)
      assert.equal(Number(width), Math.ceil(w))
      assert.equal(Number(height), Math.ceil(h))
      count++
    }
  }
  assert.equal(count, 12)
})

test('computación: nueve fragmentos publicados coinciden con el código probado', async () => {
  let count = 0
  for (const entry of manifest.articles) {
    const body = await readFile(`src/content/posts/es/${entry.slug}.md`, 'utf8')
    for (const [, path, snippet] of body.matchAll(
      /Archivo: `computacion-redes\/([^`]+)`[^\n]*\n\n```javascript\n([\s\S]*?)\n```/g,
    )) {
      assert.ok(
        normalize(await readFile(`examples/computacion-redes/${path}`, 'utf8')).includes(
          normalize(snippet),
        ),
        entry.id,
      )
      count++
    }
  }
  assert.equal(count, 9)
})

test('computación: ZIP conserva inventario y bytes sin claves o instalaciones', async () => {
  async function collect(directory) {
    const paths = []
    for (const item of await readdir(directory, { withFileTypes: true })) {
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
  const paths = JSON.parse(
    await readFile('assets/computing-series/download-manifest.json', 'utf8'),
  ).paths
  const zip = 'public/assets/examples/computacion-redes-lab.zip'
  assert.deepEqual(
    [...paths].sort(),
    (await collect('examples/computacion-redes')).sort(),
  )
  assert.deepEqual(
    execFileSync('unzip', ['-Z1', zip], { encoding: 'utf8' }).trim().split('\n').sort(),
    [...paths].sort(),
  )
  for (const path of paths) {
    assert.ok(!/\.pem$|\.key$|node_modules|\.env|\.pyc/.test(path))
    const bytes = await readFile(`examples/${path}`)
    assert.deepEqual(execFileSync('unzip', ['-p', zip, path]), bytes)
    assert.ok(!/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(bytes.toString()))
  }
})

test('computación: muestras, medianas, modelos y resultados archivados coherentes', async () => {
  const m = results.memory
  assert.equal(m.samples.length, 9)
  const q = Math.floor(m.size_bytes / 251),
    r = m.size_bytes % 251
  const expected = (q * 250 * 251) / 2 + (r * (r - 1)) / 2
  assert.equal(expected, 262139206)
  for (const row of m.samples) {
    assert.equal(row.memory_sum, expected)
    assert.equal(row.file_sum, expected)
  }
  for (const key of ['memory', 'file'])
    assert.equal(
      [...m.samples.map((row) => row[`${key}_ms`])].sort((a, b) => a - b)[4],
      m[`median_${key}_ms`],
    )
  const body = await readFile(
    'src/content/posts/es/cpu-memoria-almacenamiento-localidad.md',
    'utf8',
  )
  for (const key of ['median_memory_ms', 'median_file_ms'])
    assert.ok(body.includes(m[key].toFixed(2).replace('.', ',')))
  const access = traces()
  assert.deepEqual(results.cache.sequential, cacheTrace(access.sequential))
  assert.deepEqual(results.cache.blocked, cacheTrace(access.blocked))
  assert.deepEqual(results.representation, representation())
  assert.deepEqual(results.transport.ordered, transport())
  assert.deepEqual(results.transport.datagram, transport({ mode: 'datagram' }))
  assert.deepEqual(results.http.statuses, [200, 304, 200])
  assert.equal(results.dns.connection_status, 200)
  assert.equal(results.dns.resource_version, 1)
  assert.deepEqual(results.process.events, ['busy:start', 'busy:end', 'timer'])
  const browser = JSON.parse(
    await readFile('examples/computacion-redes/results/browser.json', 'utf8'),
  )
  assert.equal(browser.http_only_not_readable, true)
  assert.equal(browser.cors_read_rejected, true)
  assert.equal(browser.cross_origin_cookie_received, true)
  assert.ok(browser.longTasks.some((row) => row.duration >= 50))
})

test('computación: simulador publicado es el mismo módulo probado y no instala dependencias', async () => {
  for (const path of ['transport.html', 'transport-ui.mjs', 'concepts.mjs'])
    assert.deepEqual(
      await readFile(`public/assets/interactive/computing-series/${path}`),
      await readFile(`examples/computacion-redes/${path}`),
    )
  const html = await readFile(
    'public/assets/interactive/computing-series/transport.html',
    'utf8',
  )
  assert.ok(html.includes('no implementa TCP, UDP ni QUIC'))
  assert.ok(html.includes('noindex,nofollow'))
  assert.equal(
    transport({ mode: 'ordered', recovery: 0 }).filter((x) => x.late).length,
    0,
  )
  assert.equal(
    transport({ mode: 'ordered', latency: 100 }).filter((x) => x.late).length,
    6,
  )
})
