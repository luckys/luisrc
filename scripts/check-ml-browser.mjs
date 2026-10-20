import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'

// Reutilizar el navegador de QA ya definido en el laboratorio frontend.
const { chromium } = await import('@playwright/test')
const manifest = JSON.parse(await readFile('docs/editorial/ml-series.json', 'utf8'))
const origin = process.env.ML_DRAFT_ORIGIN ?? 'http://127.0.0.1:4322'
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(origin).hostname))
const evidence = await mkdtemp('/tmp/ml-browser.')
const browser = await chromium.launch({ headless: true })
const report = { browser: browser.version(), views: [], images: 0 }
try {
  const page = await browser.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(String(error)))
  for (const width of [1440, 360]) {
    await page.setViewportSize({ width, height: 1000 })
    for (const entry of manifest.articles) {
      await page.goto(`${origin}/posts/${entry.slug}`, { waitUntil: 'networkidle' })
      await page.evaluate(() => document.fonts.ready)
      const dimensions = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        client: document.documentElement.clientWidth,
      }))
      assert.ok(
        dimensions.scroll <= dimensions.client + 1,
        `${entry.id}: overflow ${JSON.stringify(dimensions)}`,
      )
      assert.equal(await page.locator('.katex-error').count(), 0)
      const images = page.locator('img[src*="/assets/visuals/ml-series/"]')
      const count = await images.count()
      assert.ok(count >= 1, entry.id)
      report.images += count
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
      }
      if (entry.id === 'P093') {
        await page.locator(`h1#${entry.slug}`).scrollIntoViewIfNeeded()
        await page.screenshot({ path: `${evidence}/post-${width}.png` })
        await page.locator('img[src*="precision-recall.svg"]').scrollIntoViewIfNeeded()
        await page.screenshot({ path: `${evidence}/chart-${width}.png` })
      }
      report.views.push({ id: entry.id, width, ...dimensions })
      console.log(`${entry.id} ${width}px OK`)
    }
  }
  assert.equal(report.images, 30)
  assert.equal(report.views.length, 20)
  await page.setViewportSize({ width: 360, height: 1000 })
  await page.goto(`${origin}/assets/interactive/ml-series/explorer.html`, {
    waitUntil: 'networkidle',
  })
  assert.equal(await page.locator('#tp').textContent(), '27')
  assert.ok((await page.locator('#summary').textContent()).includes('175'))
  await page.locator('#threshold').focus()
  await page.keyboard.press('Home')
  for (let i = 0; i < 20; i++) await page.keyboard.press('ArrowRight')
  assert.equal(await page.locator('#tp').textContent(), '37')
  assert.equal(await page.locator('#fp').textContent(), '20')
  assert.ok((await page.locator('#summary').textContent()).includes('90'))
  await page.keyboard.press('End')
  assert.equal(await page.locator('#fn').textContent(), '44')
  await page.locator('#fn-cost').fill('-1')
  assert.ok((await page.locator('#summary').textContent()).includes('Introduce costes'))
  await page.locator('#fn-cost').fill('5')
  assert.ok((await page.locator('#summary').textContent()).includes('220'))
  assert.ok(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
    ),
  )
  await page.screenshot({ path: `${evidence}/explorer-360.png`, fullPage: true })
  report.interactiveCases = 5
  assert.deepEqual(errors, [])
  await writeFile(`${evidence}/report.json`, JSON.stringify(report, null, 2) + '\n')
  console.log(evidence)
} finally {
  await browser.close()
}
