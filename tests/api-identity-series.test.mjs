import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import YAML from 'yaml'

const manifest = JSON.parse(
  await readFile('docs/editorial/api-contracts-series.json', 'utf8'),
)
const identity = manifest.articles.filter((entry) =>
  ['P026', 'P027'].includes(entry.roadmapId),
)

test('identidad: cuatro drafts españoles con extractos del código probado y diagramas completos', async () => {
  assert.deepEqual(
    identity.map((entry) => entry.id),
    ['P026', 'API-SESSION-REFRESH', 'P027', 'API-OIDC-VALIDATION'],
  )
  const code = (
    await Promise.all(
      ['state.mjs', 'lab.mjs', 'identity.mjs'].map((file) =>
        readFile(`examples/api-identidad/${file}`, 'utf8'),
      ),
    )
  )
    .join('\n')
    .replace(/\s/g, '')
  let snippets = 0
  for (const entry of identity) {
    const text = await readFile(`src/content/posts/es/${entry.slug}.md`, 'utf8')
    const meta = YAML.parse(text.match(/^---\n([\s\S]*?)\n---/)[1])
    for (const key of ['id', 'title', 'slug', 'prerequisites'])
      assert.deepEqual(meta[key], entry[key])
    assert.equal(meta.locale, 'es')
    assert.equal(meta.draft, true)
    assert.equal(meta.status, 'draft')
    assert.equal(meta.series, manifest.name)
    assert.equal(meta.author, 'Luis Ramírez Calle')
    assert.ok(text.split(/\s+/).length > 1100, entry.id)
    assert.ok(!text.includes('—'))
    for (const heading of ['Garantías y límites', 'Ejercicio:', 'Referencias'])
      assert.ok(text.includes(`## ${heading}`))
    assert.ok(text.includes('/assets/examples/api-identidad-lab.zip'))
    for (const [, snippet] of text.matchAll(/```javascript\n([\s\S]*?)\n```/g)) {
      assert.ok(code.includes(snippet.replace(/\s/g, '')), snippet)
      snippets++
    }
    for (const [, slug] of text.matchAll(/\]\(\/posts\/([^/)#]+)(?:#[^)]*)?\)/g))
      await readFile(`src/content/posts/es/${slug}.md`, 'utf8')
    const images = [
      ...text.matchAll(/<img src="([^"]+)" alt="([^"]+)" width="(\d+)" height="(\d+)"/g),
    ]
    assert.equal(images.length, 1)
    for (const [, asset, alt, width, height] of images) {
      assert.ok(alt.length > 80)
      const svg = await readFile(`public${asset}`, 'utf8')
      const [, , w, h] = svg
        .match(/viewBox="([^"]+)"/)[1]
        .split(/\s+/)
        .map(Number)
      assert.equal(+width, Math.ceil(w))
      assert.equal(+height, Math.ceil(h))
      await readFile(`assets/api-contracts/${entry.id}.d2`)
    }
  }
  assert.equal(snippets, 4)
})

test('APIs: diecinueve partes mantienen orden, fechas únicas y nueve fichas del catálogo', async () => {
  assert.equal(manifest.articles.length, 19)
  const positions = new Map(manifest.articles.map((entry, index) => [entry.id, index]))
  const dates = []
  for (const [index, entry] of manifest.articles.entries()) {
    const text = await readFile(`src/content/posts/es/${entry.slug}.md`, 'utf8')
    const meta = YAML.parse(text.match(/^---\n([\s\S]*?)\n---/)[1])
    dates.push(new Date(meta.published).getTime())
    for (const id of entry.prerequisites)
      if (positions.has(id))
        assert.ok(positions.get(id) < index, `${id} antes de ${entry.id}`)
  }
  assert.equal(new Set(dates).size, 19)
  assert.deepEqual(
    dates,
    dates.toSorted((a, b) => a - b),
  )
  assert.deepEqual(
    [...new Set(manifest.articles.map((entry) => entry.roadmapId))],
    ['P020', 'P021', 'P022', 'P023', 'P024', 'P025', 'P026', 'P027', 'P028'],
  )
})

test('identidad: el ZIP solo distribuye fuentes y lockfile idénticos, nunca claves o dependencias', async () => {
  const files = JSON.parse(
    await readFile('assets/api-contracts/identity-download-manifest.json', 'utf8'),
  )
  const archive = 'public/assets/examples/api-identidad-lab.zip'
  assert.equal(files.length, 10)
  assert.deepEqual(
    execFileSync('unzip', ['-Z1', archive], { encoding: 'utf8' })
      .trim()
      .split('\n')
      .sort(),
    files.toSorted(),
  )
  for (const file of files) {
    assert.ok(!/node_modules|\.pem|\.env|\.key/.test(file))
    assert.deepEqual(
      execFileSync('unzip', ['-p', archive, file]),
      await readFile(`examples/api-identidad/${file}`),
    )
  }
  const readme = await readFile('examples/api-identidad/README.md', 'utf8')
  for (const limit of [
    'ejercicio separado',
    'no comprueba',
    'No existe un endpoint público',
    'no demuestra SameSite/HttpOnly',
    'solo la sesión RP',
  ])
    assert.ok(readme.includes(limit), limit)
})
