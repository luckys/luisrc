import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fromHtmlIsomorphic } from 'hast-util-from-html-isomorphic'

const origin = process.env.COMPUTING_DRAFT_ORIGIN ?? 'http://127.0.0.1:4322'
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(origin).hostname))
const manifest = JSON.parse(
  await readFile('docs/editorial/computing-series.json', 'utf8'),
)
const plain = (node) =>
  node.type === 'text' ? node.value : (node.children ?? []).map(plain).join('')
const assets = new Set()
let formulas = 0
for (const [index, entry] of manifest.articles.entries()) {
  const response = await fetch(`${origin}/posts/${entry.slug}`)
  assert.equal(response.status, 200, entry.id)
  const tree = fromHtmlIsomorphic(await response.text())
  const elements = []
  function visit(node) {
    if (node.type === 'element') elements.push(node)
    node.children?.forEach(visit)
  }
  visit(tree)
  assert.equal(
    plain(elements.find((node) => node.tagName === 'h1')).trim(),
    `# ${entry.title}`,
  )
  assert.ok(
    elements.some(
      (node) =>
        node.tagName === 'meta' &&
        node.properties.name === 'robots' &&
        String(node.properties.content).includes('noindex'),
    ),
  )
  assert.ok(
    plain(tree)
      .replace(/\s+/g, ' ')
      .includes(`${manifest.name} ${index + 1} / 9`),
    entry.id,
  )
  const classes = (node) => node.properties?.className ?? []
  assert.ok(!elements.some((node) => classes(node).includes('katex-error')))
  formulas += elements.filter((node) => classes(node).includes('katex')).length
  const ids = new Set(elements.map((node) => node.properties.id).filter(Boolean))
  for (const node of elements) {
    const link = String(
      node.tagName === 'a'
        ? (node.properties.href ?? '')
        : node.tagName === 'img'
          ? (node.properties.src ?? '')
          : '',
    )
    if (link.startsWith('#') && link.length > 1)
      assert.ok(ids.has(decodeURIComponent(link.slice(1))), link)
    if (link.startsWith('/assets/')) assets.add(link)
  }
  console.log(`OK ${entry.id}`)
}
for (const asset of assets)
  assert.equal((await fetch(`${origin}${asset}`)).status, 200, asset)
assert.ok(formulas >= 2)
console.log(
  `9 drafts, ${formulas} fórmulas, ${assets.size} recursos, navegación, noindex y TOC comprobados`,
)
