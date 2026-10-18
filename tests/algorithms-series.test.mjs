import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import YAML from 'yaml'
import { workload, comparisonModel } from '../examples/estructuras-algoritmos/model.mjs'
import {
  buildIndex,
  linearSearch,
} from '../examples/estructuras-algoritmos/algorithms.ts'
import { median } from '../examples/estructuras-algoritmos/benchmark.mjs'

const manifest = JSON.parse(
  await readFile('docs/editorial/algorithms-series.json', 'utf8'),
)
const posts = await Promise.all(
  manifest.articles.map((entry) =>
    readFile(`src/content/posts/es/${entry.slug}.md`, 'utf8'),
  ),
)
const compact = (source) => source.replace(/\s+/g, '')

test('algoritmos: 21 entregas de P011, drafts españoles y dependencias anteriores', async () => {
  assert.deepEqual(
    manifest.articles.map((entry) => entry.id),
    [
      'P011',
      'DSA-02',
      ...Array.from({ length: 13 }, (_, i) => `DSA-${String(i + 4).padStart(2, '0')}`),
      'DSA-21',
      'DSA-17',
      'DSA-18',
      'DSA-19',
      'DSA-20',
      'DSA-03',
    ],
  )
  const previous = new Set()
  for (const [i, entry] of manifest.articles.entries()) {
    const metadata = YAML.parse(posts[i].match(/^---\n([\s\S]*?)\n---/)[1])
    for (const key of ['id', 'slug', 'title', 'prerequisites'])
      assert.deepEqual(metadata[key], entry[key])
    assert.equal(metadata.locale, 'es')
    assert.equal(metadata.draft, true)
    assert.equal(metadata.status, 'draft')
    assert.equal(metadata.author, 'Luis Ramírez Calle')
    assert.equal(metadata.series, manifest.name)
    for (const prerequisite of metadata.prerequisites)
      assert.ok(previous.has(prerequisite))
    previous.add(entry.id)
    assert.match(posts[i], /## Garantías y límites/)
    assert.match(posts[i], /## Ejercicio:/)
    assert.match(posts[i], /## Referencias/)
    for (const [, slug] of posts[i].matchAll(/\]\(\/posts\/([^/)#]+)(?:#[^)]*)?\)/g))
      await readFile(`src/content/posts/es/${slug}.md`, 'utf8')
    assert.ok(!posts[i].includes('—'))
    const count = posts[i].split(/\s+/).length
    assert.ok(count > 750 && count < 2400, `${entry.id}: ${count} palabras`)
  }
})

test('algoritmos: snippets publicados coinciden con código que se prueba', async () => {
  const sources = {
    typescript: compact(
      (await readFile('examples/estructuras-algoritmos/algorithms.ts', 'utf8')) +
        '\n' +
        (await readFile('examples/estructuras-algoritmos/focused.ts', 'utf8')),
    ),
    javascript: compact(
      await readFile('examples/estructuras-algoritmos/benchmark.mjs', 'utf8'),
    ),
  }
  let count = 0
  for (const post of posts)
    for (const [, language, snippet] of post.matchAll(
      /```(typescript|javascript)\n([\s\S]*?)\n```/g,
    )) {
      assert.ok(sources[language].includes(compact(snippet)), snippet)
      count++
    }
  assert.ok(count >= 18, `${count} extractos comprobados`)
})

test('algoritmos: diagramas y gráficas existen y declaran sus dimensiones reales', async () => {
  let count = 0
  for (const post of posts)
    for (const [, src, alt, width, height] of post.matchAll(
      /<img src="([^\"]+)" alt="([^\"]+)" width="(\d+)" height="(\d+)"/g,
    )) {
      assert.ok(alt.length > 80)
      const svg = await readFile(`public${src}`, 'utf8')
      const [, , w, h] = svg
        .match(/viewBox="([^\"]+)"/)[1]
        .split(/\s+/)
        .map(Number)
      assert.equal(+width, Math.ceil(w))
      assert.equal(+height, Math.ceil(h))
      count++
    }
  assert.equal(count, 5)
})

test('algoritmos: muestras archivadas, medianas y contadores se pueden recalcular', async () => {
  const results = JSON.parse(
    await readFile('examples/estructuras-algoritmos/results/benchmark.json', 'utf8'),
  )
  assert.equal(results.cases.length, 12)
  assert.deepEqual(results.method.patterns, ['first', 'last', 'miss', 'mixed'])
  for (const row of results.cases) {
    const { rows, queries } = workload(row.n, row.q, row.pattern)
    const index = buildIndex(rows)
    assert.equal(
      row.checksum,
      queries.reduce((sum, id) => sum + (index.get(id)?.id ?? -1), 0),
    )
    assert.deepEqual(
      queries.map((id) => linearSearch(rows, id)),
      queries.map((id) => index.get(id)),
    )
    assert.deepEqual(row.counts, comparisonModel(row.n, row.q, row.pattern))
    assert.equal(row.samples.length, 9)
    for (const key of ['scan', 'indexed', 'fresh']) {
      assert.equal(
        row.medians_ms[key],
        median(row.samples.map((sample) => sample[`${key}_ms`])),
      )
      for (const sample of row.samples) assert.ok(sample[`${key}_ms`] >= 0)
    }
    // La tabla del post conserva cuatro decimales con coma, no tiempos inventados.
    if (row.pattern === 'mixed' || (row.n === 20000 && row.pattern === 'first')) {
      for (const value of Object.values(row.medians_ms))
        assert.ok(posts.at(-1).includes(value.toFixed(4).replace('.', ',')))
    }
  }
})

test('algoritmos: ZIP completo y byte a byte igual al laboratorio; copias públicas sincronizadas', async () => {
  const archive = 'public/assets/examples/estructuras-algoritmos-lab.zip'
  const files = JSON.parse(
    await readFile('assets/algorithms-series/download-manifest.json', 'utf8'),
  )
  const entries = execFileSync('unzip', ['-Z1', archive], { encoding: 'utf8' })
    .trim()
    .split('\n')
  assert.deepEqual(entries.sort(), [...files].sort())
  for (const file of files)
    assert.deepEqual(
      execFileSync('unzip', ['-p', archive, file]),
      await readFile(`examples/estructuras-algoritmos/${file}`),
    )
  for (const file of [
    'explorer.html',
    'explorer.mjs',
    'model.mjs',
    'steps.html',
    'steps.mjs',
    'steps-model.mjs',
  ])
    assert.deepEqual(
      await readFile(`public/assets/interactive/algorithms-series/${file}`),
      await readFile(`examples/estructuras-algoritmos/${file}`),
    )
  const html = await readFile(
    'public/assets/interactive/algorithms-series/explorer.html',
    'utf8',
  )
  assert.match(html, /noindex,nofollow/)
  assert.match(html, /no\s+milisegundos/)
  assert.match(html, /aria-live="polite"/)
})
