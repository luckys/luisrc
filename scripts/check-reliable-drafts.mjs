import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
import YAML from 'yaml'
import { fromHtmlIsomorphic } from 'hast-util-from-html-isomorphic'

const origin = process.env.RELIABLE_DRAFT_ORIGIN ?? 'http://127.0.0.1:4322'
if (!['127.0.0.1', 'localhost'].includes(new URL(origin).hostname))
  throw new Error('Solo servidor local')
const manifest = JSON.parse(
  await readFile('docs/editorial/reliable-services-series.json', 'utf8'),
)
const assets = new Set()
let count = 0
const plain = (node) =>
  node.type === 'text' ? node.value : (node.children ?? []).map(plain).join('')
for (const series of manifest.series) {
  for (const [index, entry] of series.articles.entries()) {
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
    // PostPage antepone un # visible como parte del diseño del blog.
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
      entry.slug,
    )
    assert.ok(
      plain(tree)
        .replace(/\s+/g, ' ')
        .includes(`${series.name} ${index + 1} / ${series.articles.length}`),
      `Orden de serie: ${entry.slug}`,
    )
    const ids = new Set(elements.map((node) => node.properties.id).filter(Boolean))
    for (const link of elements.filter((node) => node.tagName === 'a')) {
      const href = String(link.properties.href ?? '')
      if (href.startsWith('#') && href.length > 1)
        assert.ok(ids.has(decodeURIComponent(href.slice(1))), `${entry.slug}: ${href}`)
      if (href.startsWith('/assets/')) assets.add(href)
    }
    const diagrams = elements.filter(
      (node) =>
        node.tagName === 'img' &&
        String(node.properties.src).includes('/reliable-services/'),
    )
    assert.ok(diagrams.length, entry.slug)
    for (const diagram of diagrams) {
      assert.ok(diagram.properties.alt)
      assert.ok(
        Number(diagram.properties.width) > 0 && Number(diagram.properties.height) > 0,
      )
      assets.add(String(diagram.properties.src))
    }
    count++
    console.log(`OK ${entry.slug}`)
  }
}
for (const asset of assets)
  assert.equal((await fetch(`${origin}${asset}`)).status, 200, asset)
console.log(
  `${count} borradores, ${assets.size} recursos, noindex, numeración de serie y anclas correctos`,
)
