import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import YAML from 'yaml'

const progress = JSON.parse(
  await readFile('docs/editorial/roadmap-progress.json', 'utf8'),
)

test('roadmap: inventario preserva las 175 fichas y dieciséis series originales', async () => {
  const source = await readFile('docs/roadmap-editorial-ingenieria-paysafe-ia.md', 'utf8')
  const catalog = source.slice(
    source.indexOf('## 3. Catálogo completo'),
    source.indexOf('## 4.'),
  )
  const actual = [...catalog.matchAll(/^#### (P\d{3})\. (.+)$/gm)].map(
    ([, id, title]) => ({ id, title }),
  )
  const entries = progress.series.flatMap((series) => series.articles)
  assert.equal(progress.series.length, 16)
  assert.equal(actual.length, 175)
  assert.deepEqual(
    entries.map(({ id, title }) => ({ id, title })),
    actual,
  )
  assert.deepEqual(
    entries.map(({ id }) => id),
    Array.from({ length: 175 }, (_, i) => `P${String(i + 1).padStart(3, '0')}`),
  )
  assert.equal(progress.completionProven, false)
})

test('roadmap: existencia directa y candidatos no se confunden con aceptación', async () => {
  const direct = new Map()
  const slugs = new Set()
  for (const filename of await readdir('src/content/posts/es')) {
    if (!/\.mdx?$/.test(filename)) continue
    const path = `src/content/posts/es/${filename}`
    const source = await readFile(path, 'utf8')
    const header = YAML.parse(source.match(/^---\n([\s\S]*?)\n---/)[1])
    slugs.add(header.slug)
    if (/^P\d{3}$/.test(header.id ?? '')) {
      assert.ok(!direct.has(header.id), header.id)
      direct.set(header.id, path)
    }
  }
  const counts = { draft_exists: 0, related_only: 0, not_written: 0 }
  for (const row of progress.series.flatMap((series) => series.articles)) {
    const status = direct.has(row.id)
      ? 'draft_exists'
      : row.related.length
        ? 'related_only'
        : 'not_written'
    assert.equal(row.status, status, row.id)
    if (status === 'draft_exists') assert.equal(row.exactPost.path, direct.get(row.id))
    else assert.equal(row.exactPost, null)
    for (const slug of row.related) assert.ok(slugs.has(slug), slug)
    assert.match(row.verification, /Revisar temario, laboratorio y DoD/)
    counts[status]++
  }
  assert.deepEqual(progress.counts, counts)
})
