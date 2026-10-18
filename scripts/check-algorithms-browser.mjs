import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFile, mkdtemp, writeFile } from 'node:fs/promises'

const require = createRequire(
  new URL('../examples/frontend-tiempo-real/package.json', import.meta.url),
)
const { chromium } = require('@playwright/test')
const origin = process.env.ALGORITHMS_DRAFT_ORIGIN ?? 'http://127.0.0.1:4322'
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(origin).hostname))
const manifest = JSON.parse(
  await readFile('docs/editorial/algorithms-series.json', 'utf8'),
)
const evidence = await mkdtemp('/tmp/algorithms-layout.')
const browser = await chromium.launch({ headless: true })
const report = { views: [], images: 0, interactiveCases: 0 }
try {
  const page = await browser.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(String(error)))
  const resources = new Set()
  for (const width of [1440, 360]) {
    await page.setViewportSize({ width, height: 1000 })
    for (const [i, entry] of manifest.articles.entries()) {
      const response = await page.goto(`${origin}/posts/${entry.slug}`, {
        waitUntil: 'networkidle',
      })
      assert.equal(response.status(), 200)
      await page.evaluate(() => document.fonts.ready)
      assert.equal(
        (await page.locator(`h1#${entry.slug}`).textContent()).trim(),
        `# ${entry.title}`,
      )
      assert.match(
        await page.locator('meta[name="robots"]').getAttribute('content'),
        /noindex/,
      )
      assert.ok(
        (await page.locator('body').innerText())
          .replace(/\s+/g, ' ')
          .includes(`${manifest.name} ${i + 1} / ${manifest.articles.length}`),
      )
      assert.equal(await page.locator('.katex-error').count(), 0)
      const brokenAnchors = await page.locator('a[href^="#"]').evaluateAll((elements) =>
        elements
          .filter((element) => {
            const id = decodeURIComponent(element.getAttribute('href').slice(1))
            return id && !document.getElementById(id)
          })
          .map((element) => element.getAttribute('href')),
      )
      assert.deepEqual(brokenAnchors, [])
      for (const asset of await page
        .locator('a[href^="/assets/"],img[src^="/assets/"]')
        .evaluateAll((elements) =>
          elements.map(
            (element) => element.getAttribute('href') ?? element.getAttribute('src'),
          ),
        ))
        resources.add(asset)
      const layout = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        client: document.documentElement.clientWidth,
      }))
      assert.ok(
        layout.scroll <= layout.client + 1,
        `${entry.id}: overflow ${JSON.stringify(layout)}`,
      )
      for (const image of await page
        .locator('img[src*="/assets/visuals/algorithms-series/"]')
        .all()) {
        await image.scrollIntoViewIfNeeded()
        await image.evaluate(async (element) => {
          if (!element.complete)
            await new Promise((resolve, reject) => {
              element.onload = resolve
              element.onerror = reject
            })
          if (!element.naturalWidth) throw new Error('Imagen no cargada')
        })
        report.images++
      }
      await page.locator(`h1#${entry.slug}`).scrollIntoViewIfNeeded()
      await page.screenshot({ path: `${evidence}/${entry.id}-${width}.png` })
      report.views.push({ id: entry.id, width, ...layout })
      console.log(`${entry.id} ${width}px: OK`)
    }
  }
  for (const asset of resources)
    assert.equal((await page.request.get(origin + asset)).status(), 200, asset)
  assert.equal(report.images, 10)
  await page.goto(`${origin}/assets/interactive/algorithms-series/explorer.html`, {
    waitUntil: 'networkidle',
  })
  await page.locator('#pattern').selectOption('last')
  assert.equal(await page.locator('#linear').textContent(), '200.000')
  await page.locator('#size').focus()
  await page.keyboard.press('End')
  assert.equal(await page.locator('#linear').textContent(), '4.000.000')
  assert.equal(await page.locator('#insertions').textContent(), '20.000')
  await page.locator('#queries').focus()
  await page.keyboard.press('Home')
  assert.equal(await page.locator('#linear').textContent(), '20.000')
  await page.locator('#pattern').selectOption('first')
  assert.equal(await page.locator('#linear').textContent(), '1')
  await page.locator('#pattern').selectOption('miss')
  assert.equal(await page.locator('#linear').textContent(), '20.000')
  assert.equal(await page.locator('#lookups').textContent(), '1')
  assert.ok(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
    ),
  )
  await page.screenshot({ path: `${evidence}/explorer-360.png`, fullPage: true })
  report.interactiveCases = 5
  await page.goto(`${origin}/assets/interactive/algorithms-series/steps.html`, {
    waitUntil: 'networkidle',
  })
  await page.getByRole('button', { name: 'Paso siguiente', exact: true }).click()
  assert.match(await page.locator('#position').textContent(), /Paso 2/)
  await page.getByRole('button', { name: 'Paso anterior', exact: true }).click()
  assert.match(await page.locator('#position').textContent(), /Paso 1/)
  while (!(await page.locator('#next').isDisabled())) await page.locator('#next').click()
  assert.match(await page.locator('#message').textContent(), /Lower bound = 1/)
  await page.locator('#values').fill('3, 1, 2')
  await page.getByRole('button', { name: 'Preparar recorrido' }).click()
  assert.match(await page.locator('#error').textContent(), /ordenados/)
  assert.ok(await page.locator('#next').isDisabled())
  await page.locator('#algorithm').selectOption('insertion')
  await page.getByRole('button', { name: 'Preparar recorrido' }).click()
  while (!(await page.locator('#next').isDisabled())) await page.locator('#next').click()
  assert.deepEqual(
    await page
      .locator('#cells .cell')
      .evaluateAll((nodes) => nodes.map((node) => node.firstChild.textContent)),
    ['1', '2', '3'],
  )
  assert.ok(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
    ),
  )
  await page.screenshot({ path: `${evidence}/steps-360.png`, fullPage: true })
  report.interactiveCases += 5
  assert.deepEqual(errors, [])
  await writeFile(`${evidence}/report.json`, JSON.stringify(report, null, 2) + '\n')
  console.log(evidence)
} finally {
  await browser.close()
}
