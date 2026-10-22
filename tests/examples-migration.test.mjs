import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir, access } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import YAML from 'yaml'

const repository = 'https://github.com/luckys/luisrc-blog-examples'
const catalog = JSON.parse(await readFile('assets/examples-migration/posts.json', 'utf8'))

test('ejemplos: el blog no conserva laboratorios ni ZIPs descargables', async () => {
  for (const directory of ['examples', 'public/assets/examples'])
    await assert.rejects(access(directory), { code: 'ENOENT' })
  assert.equal(catalog.length, 174)
  for (const { locale, slug, labs } of catalog) {
    const source = await readFile(`src/content/posts/${locale}/${slug}.md`, 'utf8')
    assert.doesNotMatch(source, /\/assets\/examples\//, slug)
    assert.ok(source.includes(`${repository}.git`), slug)
    for (const lab of labs)
      assert.ok(source.includes(`${repository}/blob/main/packages/${lab}/`), slug)
  }
})

test('contenido: metadatos, enlaces internos y recursos de todos los posts siguen siendo válidos', async () => {
  const posts = new Map()
  for (const locale of ['es', 'en']) {
    for (const name of await readdir(`src/content/posts/${locale}`)) {
      if (!/\.mdx?$/.test(name)) continue
      const source = await readFile(`src/content/posts/${locale}/${name}`, 'utf8')
      const meta = YAML.parse(source.match(/^---\n([\s\S]*?)\n---/)[1])
      assert.equal(meta.locale, locale, name)
      assert.ok(meta.author, name)
      assert.ok(!posts.has(`${locale}/${meta.slug}`))
      posts.set(`${locale}/${meta.slug}`, { source, meta })
      assert.doesNotMatch(source, /\/assets\/examples\//, name)
    }
  }
  for (const [id, { source }] of posts) {
    for (const [, locale, slug] of source.matchAll(
      /\]\(\/(en\/)?posts\/([^/)#]+)\/?(?:#[^)]*)?\)/g,
    ))
      assert.ok(posts.has(`${locale ? 'en' : 'es'}/${slug}`), `${id}: ${slug}`)
    for (const [, asset] of source.matchAll(/(?:src="|\]\()\/(assets\/[^"\s)#]+)/g))
      await access(`public/${asset}`)
  }
})

test('recursos: visores y datos editoriales tienen procedencia y hashes verificables sin checkout hermano', async () => {
  const provenance = JSON.parse(
    await readFile('assets/examples-migration/provenance.json', 'utf8'),
  )
  assert.equal(provenance.repository, repository)
  assert.equal(provenance.files.length, 48)
  for (const file of provenance.files)
    assert.equal(
      createHash('sha256')
        .update(await readFile(file.destination))
        .digest('hex'),
      file.sha256,
      file.destination,
    )
})
