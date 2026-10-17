import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import YAML from 'yaml'

const manifest = JSON.parse(
  await readFile('docs/editorial/reliable-services-series.json', 'utf8'),
)
const entries = manifest.series.flatMap((series) =>
  series.articles.map((article) => ({ ...article, series: series.name })),
)
const normalize = (text) => text.replace(/\s+/g, '')

test('ruta: 24 artículos en cuatro series, solo español y sin dependencias circulares', async () => {
  assert.equal(manifest.series.length, 4)
  assert.equal(entries.length, 24)
  const database = YAML.parse(
    await readFile('docs/editorial/database-fundamentals.yaml', 'utf8'),
  )
  const seen = new Set(database.articles.map((article) => article.id))
  const slugs = new Set()
  let lastDate = 0
  for (const entry of entries) {
    assert.ok(!seen.has(entry.id), entry.id)
    assert.ok(!slugs.has(entry.slug), entry.slug)
    for (const prerequisite of entry.prerequisites)
      assert.ok(seen.has(prerequisite), `${entry.id}: ${prerequisite}`)
    const text = await readFile(`src/content/posts/es/${entry.slug}.md`, 'utf8')
    const header = YAML.parse(text.match(/^---\n([\s\S]*?)\n---/)[1])
    assert.equal(header.id, entry.id)
    assert.equal(header.title, entry.title)
    assert.equal(header.slug, entry.slug)
    assert.equal(header.locale, 'es')
    assert.equal(header.series, entry.series)
    assert.equal(header.draft, true)
    assert.equal(header.status, 'draft')
    assert.equal(header.author, 'Luis Ramírez Calle')
    assert.deepEqual(header.prerequisites, entry.prerequisites)
    const date = new Date(header.published).valueOf()
    assert.ok(date > lastDate)
    lastDate = date
    assert.ok(text.includes('## Garantías y límites'))
    assert.ok(text.includes('## Ejercicio:'))
    assert.ok(text.includes('## Referencias'))
    assert.ok(text.includes('/assets/examples/servicios-fiables-lab.zip'))
    assert.ok(!/PaySafe/i.test(text), 'Contenido independiente del proyecto')
    assert.ok(!text.includes('—'), 'Sin guiones largos')
    const words = text.split(/\s+/).length
    assert.ok(words >= 600 && words <= 1500, `${entry.id}: ${words} palabras`)
    seen.add(entry.id)
    slugs.add(entry.slug)
  }
})

test('recursos: enlaces internos, SVG y dimensiones coinciden con el contenido', async () => {
  const localSlugs = new Set(
    (await readdir('src/content/posts/es'))
      .filter((name) => name.endsWith('.md'))
      .map((name) => name.slice(0, -3)),
  )
  for (const entry of entries) {
    const text = await readFile(`src/content/posts/es/${entry.slug}.md`, 'utf8')
    for (const [, slug] of text.matchAll(/\]\(\/posts\/([^)#]+)(?:#[^)]*)?\)/g))
      assert.ok(localSlugs.has(slug), slug)
    for (const [, path] of text.matchAll(/\]\((\/assets\/[^)]+)\)/g))
      assert.ok((await readFile(`public${path}`)).length, path)
    const diagrams = [
      ...text.matchAll(
        /<img src="([^\"]+)" alt="([^\"]+)" width="(\d+)" height="(\d+)"/g,
      ),
    ]
    assert.ok(diagrams.length, entry.id)
    for (const [, path, alt, width, height] of diagrams) {
      assert.ok(alt.length > 30)
      const svg = await readFile(`public${path}`, 'utf8')
      const dimensions = svg
        .match(/viewBox="([^\"]+)"/)[1]
        .split(/\s+/)
        .map(Number)
      assert.equal(Number(width), Math.ceil(dimensions[2]), path)
      assert.equal(Number(height), Math.ceil(dimensions[3]), path)
    }
  }
})

test('código: extractos publicados corresponden a los archivos probados', async () => {
  let snippets = 0
  for (const entry of entries) {
    const text = await readFile(`src/content/posts/es/${entry.slug}.md`, 'utf8')
    for (const [, path, code] of text.matchAll(
      /Archivo: `servicios-fiables\/([^`]+)`[^\n]*\n\n```(?:typescript|javascript|sql)\n([\s\S]*?)\n```/g,
    )) {
      const original = await readFile(`examples/servicios-fiables/${path}`, 'utf8')
      assert.ok(normalize(original).includes(normalize(code)), `${entry.id}: ${path}`)
      snippets++
    }
  }
  assert.ok(snippets >= 15, `${snippets} extractos encontrados`)
})

test('ZIP: inventario exacto y bytes idénticos, sin node_modules ni secretos', async () => {
  const zip = 'public/assets/examples/servicios-fiables-lab.zip'
  const paths = JSON.parse(
    await readFile('assets/reliable-services/download-manifest.json', 'utf8'),
  ).paths
  const actual = execFileSync('unzip', ['-Z1', zip], { encoding: 'utf8' })
    .trim()
    .split('\n')
  assert.deepEqual(actual.sort(), [...paths].sort())
  for (const path of paths) {
    assert.ok(path.startsWith('servicios-fiables/') && !path.includes('..'))
    assert.ok(!path.includes('node_modules') && !path.includes('.env'))
    assert.deepEqual(
      execFileSync('unzip', ['-p', zip, path]),
      await readFile(`examples/${path}`),
      path,
    )
  }
})

test('medición: cada etapa conserva muestras, status y cálculos reproducibles', async () => {
  const results = JSON.parse(
    await readFile('examples/servicios-fiables/results/load.json', 'utf8'),
  )
  assert.equal(results.model, 'closed-loop')
  assert.equal(results.max_active, 4)
  for (const stage of results.stages) {
    assert.equal(stage.requests, 120)
    assert.equal(stage.samples.length, stage.requests)
    assert.equal(
      stage.successes,
      stage.samples.filter((sample) => sample.status === 200).length,
    )
    assert.equal(stage.errors + stage.successes, stage.requests)
    assert.equal(stage.successful_rps, stage.successes / stage.seconds)
    const sorted = stage.samples.map((sample) => sample.ms).sort((a, b) => a - b)
    for (const [key, p] of [
      ['p50', 0.5],
      ['p95', 0.95],
      ['p99', 0.99],
    ])
      assert.equal(stage[key], sorted[Math.ceil(p * sorted.length) - 1])
  }
})
