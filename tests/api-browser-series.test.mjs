import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import YAML from 'yaml'

const manifest = JSON.parse(
  await readFile('docs/editorial/api-contracts-series.json', 'utf8'),
)
const entries = manifest.articles.filter((entry) => entry.roadmapId === 'P029')

test('navegador: cuatro temas específicos, drafts españoles, extractos reales y diagramas', async () => {
  assert.deepEqual(
    entries.map((entry) => entry.id),
    ['P029', 'API-BROWSER-CSP', 'API-BROWSER-CSRF', 'API-BROWSER-CORS'],
  )
  const code = (
    await Promise.all(
      ['lab.mjs', 'render.mjs'].map((file) =>
        readFile(`examples/api-navegador/${file}`, 'utf8'),
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
    assert.equal(meta.author, 'Luis Ramírez Calle')
    assert.equal(meta.series, manifest.name)
    assert.ok(!text.includes('—'))
    for (const heading of ['Garantías y límites', 'Ejercicio:', 'Referencias'])
      assert.ok(text.includes(`## ${heading}`), entry.id)
    assert.ok(text.includes('/assets/examples/api-navegador-lab.zip'))
    for (const [, snippet] of text.matchAll(/```javascript\n([\s\S]*?)\n```/g)) {
      assert.ok(code.includes(snippet.replace(/\s/g, '')), snippet)
      snippets++
    }
    for (const [, slug] of text.matchAll(/\]\(\/posts\/([^/)#]+)(?:#[^)]*)?\)/g))
      await readFile(`src/content/posts/es/${slug}.md`)
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
  assert.equal(snippets, 3)
})

test('navegador: ZIP contiene nueve fuentes exactas, sin navegador, instalaciones o secretos', async () => {
  const files = JSON.parse(
    await readFile('assets/api-contracts/browser-download-manifest.json', 'utf8'),
  )
  const archive = 'public/assets/examples/api-navegador-lab.zip'
  assert.equal(files.length, 9)
  assert.deepEqual(
    execFileSync('unzip', ['-Z1', archive], { encoding: 'utf8' })
      .trim()
      .split('\n')
      .sort(),
    files.toSorted(),
  )
  for (const file of files) {
    assert.ok(!/node_modules|\.pem|\.env|\.key|test-results|\.png/.test(file))
    assert.deepEqual(
      execFileSync('unzip', ['-p', archive, file]),
      await readFile(`examples/api-navegador/${file}`),
    )
  }
  const pkg = JSON.parse(await readFile('examples/api-navegador/package.json', 'utf8'))
  assert.equal(pkg.dependencies, undefined)
  assert.equal(pkg.devDependencies['@playwright/test'], '1.56.1')
  const readme = await readFile('examples/api-navegador/README.md', 'utf8')
  for (const limitation of [
    'intencionadamente vulnerable',
    'no aíslan cookies por puerto',
    'sin Secure ni garantías TLS',
    'no es un aislamiento de red',
    'Solo Chromium probado',
  ])
    assert.ok(readme.includes(limitation), limitation)
})
