import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
import YAML from 'yaml'
import { fromHtmlIsomorphic } from 'hast-util-from-html-isomorphic'

const origin = process.env.MATH_DRAFT_ORIGIN ?? 'http://127.0.0.1:4322'
if (!['127.0.0.1', 'localhost'].includes(new URL(origin).hostname))
  throw new Error('Solo servidor local')
const manifest = JSON.parse(await readFile('docs/editorial/math-series.json', 'utf8'))
const assets = new Set()
let formulas = 0
const plain = (node) =>
  node.type === 'text' ? node.value : (node.children ?? []).map(plain).join('')
for (const [index, entry] of manifest.articles.entries()) {
  const source = await readFile(`src/content/posts/es/${entry.slug}.md`, 'utf8')
  const header = YAML.parse(source.match(/^---\n([\s\S]*?)\n---/)[1])
  const response = await fetch(`${origin}/posts/${entry.slug}`)
  assert.equal(response.status, 200, entry.slug)
  const tree = fromHtmlIsomorphic(await response.text())
  const elements = []
  function visit(node) {
    if (node.type === 'element') elements.push(node)
    node.children?.forEach(visit)
  }
  visit(tree)
  assert.equal(
    plain(elements.find((node) => node.tagName === 'h1')).trim(),
    `# ${header.title}`,
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
      .includes(`${manifest.name} ${index + 1} / 10`),
    entry.slug,
  )
  const classes = (node) => node.properties?.className ?? []
  assert.ok(!elements.some((node) => classes(node).includes('katex-error')), entry.slug)
  const rendered = elements.filter((node) => classes(node).includes('katex'))
  assert.ok(rendered.length, `KaTeX: ${entry.slug}`)
  formulas += rendered.length
  assert.ok(
    elements.some(
      (node) => node.tagName === 'link' && String(node.properties.href).includes('katex'),
    ),
    'CSS de fórmulas',
  )
  const ids = new Set(elements.map((node) => node.properties.id).filter(Boolean))
  for (const link of elements.filter((node) => node.tagName === 'a')) {
    const href = String(link.properties.href ?? '')
    if (href.startsWith('#') && href.length > 1)
      assert.ok(ids.has(decodeURIComponent(href.slice(1))), href)
    if (href.startsWith('/assets/')) assets.add(href)
  }
  console.log(`OK ${entry.id}: ${rendered.length} fórmulas`)
}
for (const asset of assets)
  assert.equal((await fetch(`${origin}${asset}`)).status, 200, asset)
console.log(
  `10 borradores, ${formulas} fórmulas, ${assets.size} recursos, CSS, noindex y TOC correctos`,
)
