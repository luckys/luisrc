import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import YAML from 'yaml'

const manifest = JSON.parse(
  await readFile('docs/editorial/api-contracts-series.json', 'utf8'),
)
const entries = manifest.articles.filter((entry) => entry.roadmapId === 'P028')

test('permisos: tres drafts españoles con código probado, diagramas y enlaces existentes', async () => {
  assert.deepEqual(
    entries.map((entry) => entry.id),
    ['P028', 'API-AUTHZ-TENANT', 'API-AUTHZ-TESTS'],
  )
  const source = (
    await Promise.all(
      ['policy.mjs', 'fixtures.mjs', 'server.mjs', 'tests/http.test.mjs'].map((file) =>
        readFile(`examples/api-permisos/${file}`, 'utf8'),
      ),
    )
  )
    .join('\n')
    .replace(/\s/g, '')
  let snippets = 0
  for (const entry of entries) {
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
      assert.ok(text.includes(`## ${heading}`), entry.id)
    assert.ok(text.includes('/assets/examples/api-permisos-lab.zip'))
    for (const [, code] of text.matchAll(/```javascript\n([\s\S]*?)\n```/g)) {
      assert.ok(source.includes(code.replace(/\s/g, '')), code)
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
  assert.equal(snippets, 5)
})

test('permisos: ZIP de once fuentes idénticas y sin dependencias o secretos', async () => {
  const files = JSON.parse(
    await readFile('assets/api-contracts/authorization-download-manifest.json', 'utf8'),
  )
  const archive = 'public/assets/examples/api-permisos-lab.zip'
  assert.equal(files.length, 11)
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
      await readFile(`examples/api-permisos/${file}`),
    )
  }
  const pkg = JSON.parse(await readFile('examples/api-permisos/package.json', 'utf8'))
  assert.equal(pkg.dependencies, undefined)
  assert.equal(pkg.devDependencies, undefined)
})

test('permisos: el visor público usa exactamente la política ejecutada en el laboratorio', async () => {
  for (const file of ['policy.mjs', 'explorer.html', 'explorer.css', 'explorer.mjs'])
    assert.deepEqual(
      await readFile(`examples/api-permisos/${file}`),
      await readFile(`public/assets/interactive/api-authorization/${file}`),
    )
  const html = await readFile('examples/api-permisos/explorer.html', 'utf8')
  assert.ok(html.includes('aria-live="polite"'))
  assert.equal((html.match(/<label[\s>]/g) ?? []).length, 5)
  const script = await readFile('examples/api-permisos/explorer.mjs', 'utf8')
  assert.ok(script.includes("import { can } from './policy.mjs'"))
  assert.ok(!script.includes('innerHTML'))
  assert.ok(!script.includes('fetch('))
})
