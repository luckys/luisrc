import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import YAML from 'yaml'

const manifest = JSON.parse(await readFile('docs/editorial/frontend-series.json', 'utf8'))
const entries = manifest.articles
const normalize = (text) => text.replace(/\s+/g, '')

test('frontend: nueve borradores españoles ordenados y prerrequisitos sin ciclos', async () => {
  assert.equal(entries.length, 9)
  const reliable = JSON.parse(
    await readFile('docs/editorial/reliable-services-series.json', 'utf8'),
  )
  const seen = new Set(
    reliable.series.flatMap((series) => series.articles.map((article) => article.id)),
  )
  let last = 0
  for (const [index, entry] of entries.entries()) {
    assert.equal(entry.id, `P0${67 + index}`)
    assert.ok(!seen.has(entry.id))
    for (const prerequisite of entry.prerequisites)
      assert.ok(seen.has(prerequisite), prerequisite)
    const body = await readFile(`src/content/posts/es/${entry.slug}.md`, 'utf8')
    const header = YAML.parse(body.match(/^---\n([\s\S]*?)\n---/)[1])
    for (const key of ['id', 'slug', 'title']) assert.equal(header[key], entry[key])
    assert.equal(header.locale, 'es')
    assert.equal(header.draft, true)
    assert.equal(header.status, 'draft')
    assert.equal(header.author, 'Luis Ramírez Calle')
    assert.equal(header.series, manifest.name)
    assert.deepEqual(header.prerequisites, entry.prerequisites)
    const date = new Date(header.published).valueOf()
    assert.ok(date > last)
    last = date
    for (const section of ['## Garantías y límites', '## Ejercicio:', '## Referencias'])
      assert.ok(body.includes(section), entry.id)
    assert.ok(body.includes('/assets/examples/frontend-tiempo-real-lab.zip'))
    assert.ok(!/PaySafe|—/.test(body))
    const words = body.split(/\s+/).length
    assert.ok(words >= 650 && words < 1600, `${entry.id}: ${words}`)
    seen.add(entry.id)
  }
})

test('frontend: enlaces, alt y dimensiones SVG corresponden a recursos existentes', async () => {
  const slugs = new Set(
    (await readdir('src/content/posts/es'))
      .filter((name) => name.endsWith('.md'))
      .map((name) => name.slice(0, -3)),
  )
  for (const entry of entries) {
    const body = await readFile(`src/content/posts/es/${entry.slug}.md`, 'utf8')
    for (const [, slug] of body.matchAll(/\]\(\/posts\/([^)#]+)(?:#[^)]*)?\)/g))
      assert.ok(slugs.has(slug), slug)
    const diagrams = [
      ...body.matchAll(
        /<img src="([^\"]+)" alt="([^\"]+)" width="(\d+)" height="(\d+)"/g,
      ),
    ]
    assert.ok(diagrams.length, entry.id)
    for (const [, path, alt, width, height] of diagrams) {
      assert.ok(alt.length > 40)
      const svg = await readFile(`public${path}`, 'utf8')
      const [, , expectedWidth, expectedHeight] = svg
        .match(/viewBox="([^\"]+)"/)[1]
        .split(/\s+/)
        .map(Number)
      assert.equal(Number(width), Math.ceil(expectedWidth))
      assert.equal(Number(height), Math.ceil(expectedHeight))
    }
  }
})

test('frontend: fragmentos de código publicados coinciden con los archivos probados', async () => {
  let count = 0
  for (const entry of entries) {
    const body = await readFile(`src/content/posts/es/${entry.slug}.md`, 'utf8')
    for (const [, path, snippet] of body.matchAll(
      /Archivo: `frontend-tiempo-real\/([^`]+)`[^\n]*\n\n```(?:tsx|typescript|javascript|css)\n([\s\S]*?)\n```/g,
    )) {
      assert.ok(
        normalize(
          await readFile(`examples/frontend-tiempo-real/${path}`, 'utf8'),
        ).includes(normalize(snippet)),
        `${entry.id}: ${path}`,
      )
      count++
    }
  }
  assert.ok(count >= 10, `${count} extractos`)
})

test('frontend: ZIP completo sin artefactos instalados y con bytes idénticos', async () => {
  const ignored = new Set(['node_modules', 'dist', 'test-results', 'playwright-report'])
  async function collect(directory) {
    const paths = []
    for (const item of await readdir(directory, { withFileTypes: true })) {
      if (item.name.startsWith('.') || ignored.has(item.name)) continue
      const path = `${directory}/${item.name}`
      if (item.isDirectory()) paths.push(...(await collect(path)))
      else if (item.isFile()) paths.push(path.replace(/^examples\//, ''))
    }
    return paths
  }
  const paths = JSON.parse(
    await readFile('assets/frontend-series/download-manifest.json', 'utf8'),
  ).paths
  assert.deepEqual(
    [...paths].sort(),
    (await collect('examples/frontend-tiempo-real')).sort(),
  )
  const zip = 'public/assets/examples/frontend-tiempo-real-lab.zip'
  const actual = execFileSync('unzip', ['-Z1', zip], { encoding: 'utf8' })
    .trim()
    .split('\n')
  assert.deepEqual(actual.sort(), [...paths].sort())
  assert.ok(paths.includes('frontend-tiempo-real/pnpm-lock.yaml'))
  assert.ok(paths.includes('frontend-tiempo-real/pnpm-workspace.yaml'))
  const lock = YAML.parseAllDocuments(
    await readFile('examples/frontend-tiempo-real/pnpm-lock.yaml', 'utf8'),
  )
    .map((document) => document.toJS())
    .find((document) => document.importers?.['.']?.dependencies?.react)
  assert.equal(lock.importers['.'].dependencies.react.specifier, '19.2.0')
  for (const path of paths)
    assert.deepEqual(
      execFileSync('unzip', ['-p', zip, path]),
      await readFile(`examples/${path}`),
      path,
    )
})

test('frontend: medianas archivadas se recalculan desde las catorce muestras', async () => {
  const result = JSON.parse(
    await readFile('examples/frontend-tiempo-real/results/dom.json', 'utf8'),
  )
  assert.equal(result.samples.length, 14)
  assert.match(result.metric, /not INP/)
  for (const summary of result.medians) {
    const values = result.samples
      .filter((sample) => sample.mounted === summary.mounted)
      .map((sample) => sample.ms)
      .sort((a, b) => a - b)
    assert.equal(values.length, 7)
    assert.ok(values.every((value) => value >= 0 && Number.isFinite(value)))
    assert.equal(summary.ms, values[3])
  }
})
