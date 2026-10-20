import assert from 'node:assert/strict'
import { readFile, mkdtemp, writeFile } from 'node:fs/promises'

const { chromium } = await import('@playwright/test')
const origin = process.env.COMPUTING_DRAFT_ORIGIN ?? 'http://127.0.0.1:4322'
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(origin).hostname))
const manifest = JSON.parse(
  await readFile('docs/editorial/computing-series.json', 'utf8'),
)
const evidence = await mkdtemp('/tmp/computing-layout.')
const browser = await chromium.launch({ headless: true })
const report = { views: [], images: 0, interactiveCases: 0 }
try {
  const page = await browser.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(String(error)))
  for (const width of [1440, 360]) {
    await page.setViewportSize({ width, height: 1000 })
    for (const entry of manifest.articles) {
      await page.goto(`${origin}/posts/${entry.slug}`, { waitUntil: 'networkidle' })
      await page.evaluate(() => document.fonts.ready)
      const layout = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        client: document.documentElement.clientWidth,
      }))
      assert.ok(
        layout.scroll <= layout.client + 1,
        `${entry.id} ${width}: overflow ${JSON.stringify(layout)}`,
      )
      assert.equal(await page.locator('.katex-error').count(), 0)
      const images = page.locator('img[src*="/assets/visuals/computing-series/"]')
      assert.ok((await images.count()) >= 1)
      for (const image of await images.all()) {
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
      if (entry.id === 'P008') {
        await page.locator(`h1#${entry.slug}`).scrollIntoViewIfNeeded()
        await page.screenshot({ path: `${evidence}/post-${width}.png` })
      }
      report.views.push({ id: entry.id, width, ...layout })
      console.log(`${entry.id} ${width}px OK`)
    }
  }
  assert.equal(report.views.length, 18)
  assert.equal(report.images, 24)
  await page.goto(`${origin}/assets/interactive/computing-series/transport.html`, {
    waitUntil: 'networkidle',
  })
  assert.ok((await page.locator('#summary').textContent()).includes('3 unidades tarde'))
  assert.equal(await page.locator('#rows tr').count(), 6)
  await page.locator('#recovery').focus()
  await page.keyboard.press('Home')
  assert.ok((await page.locator('#summary').textContent()).includes('0 unidades tarde'))
  await page.locator('#latency').focus()
  await page.keyboard.press('End')
  assert.ok((await page.locator('#summary').textContent()).includes('6 unidades tarde'))
  await page.locator('#deadline').focus()
  await page.keyboard.press('End')
  assert.ok((await page.locator('#summary').textContent()).includes('0 unidades tarde'))
  assert.ok(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
    ),
  )
  report.interactiveCases = 4
  await page.screenshot({ path: `${evidence}/transport-360.png`, fullPage: true })
  assert.deepEqual(errors, [])
  await writeFile(`${evidence}/report.json`, JSON.stringify(report, null, 2) + '\n')
  console.log(evidence)
} finally {
  await browser.close()
}
