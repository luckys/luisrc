import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fromHtmlIsomorphic as fromHtml } from 'hast-util-from-html-isomorphic'
import { parse } from 'yaml'

const output = new URL('../dist/', import.meta.url)
const origin = 'https://luisrc.pages.dev'
const read = (path) => readFileSync(new URL(path, output), 'utf8')
const fileFor = (url) => {
  const path = new URL(url, origin).pathname.replace(/^\//, '')
  return new URL(
    /\.[a-z]+$/i.test(path) ? path : `${path ? `${path}/` : ''}index.html`,
    output,
  )
}
const find = (node, predicate) => [
  ...(predicate(node) ? [node] : []),
  ...(node.children || []).flatMap((child) => find(child, predicate)),
]
const elements = (tree, tag) => find(tree, (node) => node.tagName === tag)
const text = (node) => node.value || (node.children || []).map(text).join('')
const articles = ['es', 'en'].flatMap((locale) => {
  const directory = new URL(`../src/content/posts/${locale}/`, import.meta.url)
  return readdirSync(directory)
    .filter((file) => /\.mdx?$/.test(file))
    .map((file) => {
      const source = readFileSync(new URL(file, directory), 'utf8')
      const [, frontmatter, body] = source.match(
        /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/,
      )
      const data = parse(frontmatter)
      return {
        ...data,
        body,
        url: `${origin}/${locale === 'en' ? 'en/' : ''}posts/${data.slug}`,
      }
    })
})

test('published articles have readable Markdown, canonical attribution and discoverable source links', () => {
  const index = read('llms.txt')
  for (const article of articles.filter((post) => !post.draft)) {
    const tree = fromHtml(readFileSync(fileFor(article.url), 'utf8'))
    const source = elements(tree, 'link').find(
      (node) => node.properties.type === 'text/markdown',
    )
    assert.equal(source?.properties.href, `${article.url}.md`)
    const markdown = readFileSync(fileFor(source.properties.href), 'utf8')
    assert.ok(markdown.includes(`Canonical: ${article.url}`))
    assert.ok(
      markdown.includes(article.body.trim()),
      'keep code, source links and article text intact',
    )
    assert.ok(index.includes(`${article.url}.md`))
  }
})

test('drafts never leak through Markdown, the LLM index or sitemap', () => {
  const index = read('llms.txt') + read('sitemap-0.xml')
  for (const article of articles.filter((post) => post.draft)) {
    assert.ok(!existsSync(fileFor(article.url)))
    assert.ok(!existsSync(fileFor(`${article.url}.md`)))
    assert.ok(!index.includes(article.url))
  }
})

test('article metadata uses real reciprocal translations and existing localized social images', () => {
  for (const article of articles.filter((post) => !post.draft)) {
    const tree = fromHtml(readFileSync(fileFor(article.url), 'utf8'))
    const meta = elements(tree, 'meta')
    const value = (key) =>
      meta.find((node) => (node.properties.property || node.properties.name) === key)
        ?.properties.content
    assert.equal(
      elements(tree, 'link').find((node) => node.properties.rel?.includes('canonical'))
        ?.properties.href,
      article.url,
    )
    assert.equal(value('og:type'), 'article')
    assert.equal(value('og:url'), article.url)
    assert.equal(value('og:image:width'), '1200')
    assert.equal(value('og:image:height'), '630')
    assert.equal(value('og:image:alt'), article.title)
    const image = value('og:image')
    assert.ok(existsSync(fileFor(image)))
    const png = readFileSync(fileFor(image))
    assert.equal(png.readUInt32BE(16), 1200)
    assert.equal(png.readUInt32BE(20), 630)
    if (article.locale === 'en') assert.ok(image.includes('/social-cards/en-'))
    const equivalent = articles.find(
      (post) =>
        !post.draft &&
        post.locale !== article.locale &&
        post.translationKey === article.translationKey,
    )
    const alternate = elements(tree, 'link').find(
      (node) => node.properties.hrefLang === (article.locale === 'en' ? 'es' : 'en'),
    )
    assert.equal(alternate?.properties.href, equivalent?.url)
    const graph = JSON.parse(
      text(
        elements(tree, 'script').find(
          (node) => node.properties.type === 'application/ld+json',
        ),
      ),
    )['@graph']
    const posting = graph.find((node) => node['@type'] === 'BlogPosting')
    assert.equal(posting.url, article.url)
    assert.equal(posting.headline, article.title)
    assert.equal(posting.datePublished, new Date(article.published).toISOString())
  }
})

test('every emitted hreflang targets an existing page, and feeds match the page language', () => {
  function walk(directory) {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      const path = join(directory, entry.name)
      return entry.isDirectory() ? walk(path) : path.endsWith('.html') ? [path] : []
    })
  }
  for (const path of walk(output.pathname)) {
    const tree = fromHtml(readFileSync(path, 'utf8'))
    const links = elements(tree, 'link')
    for (const link of links.filter((node) => node.properties.hrefLang)) {
      assert.ok(
        existsSync(fileFor(link.properties.href)),
        `Broken hreflang in ${path}: ${link.properties.href}`,
      )
    }
    const language = elements(tree, 'html')[0].properties.lang
    const feed = links.find((node) => node.properties.type === 'application/rss+xml')
    if (feed)
      assert.equal(
        feed.properties.href,
        `${origin}${language === 'en' ? '/en/rss.xml' : '/rss.xml'}`,
      )
    assert.ok(elements(tree, 'h1').length <= 1, `Multiple primary headings in ${path}`)
  }
  const sitemap = read('sitemap-0.xml')
  assert.ok(!sitemap.includes('.md</loc>'))
})
