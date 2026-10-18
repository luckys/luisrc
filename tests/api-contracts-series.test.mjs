import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import YAML from 'yaml'

const manifest = JSON.parse(
  await readFile('docs/editorial/api-contracts-series.json', 'utf8'),
)
test('APIs: dos borradores españoles, extractos reales y esquema compartido', async () => {
  assert.deepEqual(
    manifest.articles.map((x) => x.id),
    ['P020', 'P021'],
  )
  const source = (await readFile('examples/api-contratos/server.mjs', 'utf8')).replace(
    /\s/g,
    '',
  )
  const api = JSON.parse(await readFile('examples/api-contratos/openapi.json', 'utf8'))
  let snippets = 0
  for (const entry of manifest.articles) {
    const text = await readFile(`src/content/posts/es/${entry.slug}.md`, 'utf8')
    const metadata = YAML.parse(text.match(/^---\n([\s\S]*?)\n---/)[1])
    for (const key of ['id', 'slug', 'title', 'prerequisites'])
      assert.deepEqual(metadata[key], entry[key])
    assert.equal(metadata.locale, 'es')
    assert.equal(metadata.author, 'Luis Ramírez Calle')
    assert.equal(metadata.draft, true)
    assert.equal(metadata.status, 'draft')
    assert.equal(metadata.series, manifest.name)
    for (const [, slug] of text.matchAll(/\]\(\/posts\/([^/)#]+)(?:#[^)]*)?\)/g))
      await readFile(`src/content/posts/es/${slug}.md`, 'utf8')
    for (const heading of ['Garantías y límites', 'Ejercicio:', 'Referencias'])
      assert.ok(text.includes(`## ${heading}`))
    assert.ok(!text.includes('—'))
    assert.ok(text.split(/\s+/).length > 1100)
    for (const [, snippet] of text.matchAll(/```javascript\n([\s\S]*?)\n```/g)) {
      assert.ok(source.includes(snippet.replace(/\s/g, '')), snippet)
      snippets++
    }
    for (const [, snippet] of text.matchAll(/```json\n([\s\S]*?)\n```/g))
      assert.deepEqual(JSON.parse(snippet), api.components.schemas.OrderInput)
    for (const [, asset, width, height] of text.matchAll(
      /<img src="([^"]+)"[^>]+width="(\d+)" height="(\d+)"/g,
    )) {
      const svg = await readFile(`public${asset}`, 'utf8')
      const [, , w, h] = svg
        .match(/viewBox="([^"]+)"/)[1]
        .split(/\s+/)
        .map(Number)
      assert.equal(+width, Math.ceil(w))
      assert.equal(+height, Math.ceil(h))
    }
  }
  assert.equal(snippets, 2)
})

test('APIs: ZIP con inventario exacto y archivos idénticos al laboratorio', async () => {
  const archive = 'public/assets/examples/api-contratos-lab.zip'
  const files = JSON.parse(
    await readFile('assets/api-contracts/download-manifest.json', 'utf8'),
  )
  assert.deepEqual(
    execFileSync('unzip', ['-Z1', archive], { encoding: 'utf8' })
      .trim()
      .split('\n')
      .sort(),
    [...files].sort(),
  )
  for (const file of files)
    assert.deepEqual(
      execFileSync('unzip', ['-p', archive, file]),
      await readFile(`examples/api-contratos/${file}`),
    )
})
