import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
import YAML from 'yaml'
import { fromHtmlIsomorphic } from 'hast-util-from-html-isomorphic'

const origin = process.env.DATABASE_DRAFT_ORIGIN ?? 'http://127.0.0.1:4321'
if (!['127.0.0.1', 'localhost'].includes(new URL(origin).hostname))
  throw new Error('Solo revisión del servidor local')
const manifest = YAML.parse(
  await readFile('docs/editorial/database-fundamentals.yaml', 'utf8'),
)
let count = 0
const assets = new Set()
for (const entry of manifest.articles.slice(2)) {
  const content = await readFile(entry.path, 'utf8')
  const data = YAML.parse(content.match(/^---\n([\s\S]*?)\n---/)[1])
  const response = await fetch(`${origin}/posts/${data.slug}`)
  assert.equal(response.status, 200, data.slug)
  const tree = fromHtmlIsomorphic(await response.text())
  const elements = []
  function visit(node) {
    if (node.type === 'element') elements.push(node)
    node.children?.forEach(visit)
  }
  visit(tree)
  assert.ok(
    elements.some((n) => n.tagName === 'h1'),
    data.slug,
  )
  assert.ok(
    elements.some(
      (n) =>
        n.tagName === 'meta' &&
        n.properties.name === 'robots' &&
        String(n.properties.content).includes('noindex'),
    ),
    data.slug,
  )
  const diagrams = elements.filter(
    (n) => n.tagName === 'img' && String(n.properties.src).includes('/database-series/'),
  )
  assert.ok(diagrams.length, data.slug)
  for (const img of diagrams) {
    assert.ok(img.properties.alt)
    assert.ok(Number(img.properties.width) > 0 && Number(img.properties.height) > 0)
    assets.add(img.properties.src)
  }
  const ids = new Set(elements.map((n) => n.properties.id).filter(Boolean))
  for (const link of elements.filter((n) => n.tagName === 'a')) {
    const href = String(link.properties.href ?? '')
    if (href.startsWith('#') && href.length > 1)
      assert.ok(ids.has(decodeURIComponent(href.slice(1))), `${data.slug}: ${href}`)
    if (href.startsWith('/assets/')) assets.add(href)
  }
  console.log(`OK ${data.slug}`)
  count++
}
for (const asset of assets) {
  const response = await fetch(`${origin}${asset}`)
  assert.equal(response.status, 200, asset)
}
console.log(
  `${count} borradores, ${assets.size} recursos locales, noindex y anclas correctos`,
)
