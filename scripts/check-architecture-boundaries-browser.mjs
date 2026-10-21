import assert from 'node:assert/strict'
import { readFile, mkdtemp, writeFile } from 'node:fs/promises'
import { chromium } from '@playwright/test'

const origin = process.env.ARCH_DRAFT_ORIGIN ?? 'http://127.0.0.1:4322'
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(origin).hostname))
const manifest = JSON.parse(
  await readFile('docs/editorial/architecture-boundaries-series.json'),
)
const folder = await mkdtemp('/tmp/architecture-boundaries-layout.')
const report = []
const browser = await chromium.launch({ headless: true })
try {
  const page = await browser.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(String(error)))
  for (const width of [1440, 360]) {
    await page.setViewportSize({ width, height: 1000 })
    for (const entry of manifest.articles) {
      const response = await page.goto(`${origin}/posts/${entry.slug}`, {
        waitUntil: 'networkidle',
      })
      assert.equal(response.status(), 200)
      assert.equal(
        (await page.locator(`h1#${entry.slug}`).textContent()).trim(),
        `# ${entry.title}`,
      )
      assert.match(
        await page.locator('meta[name="robots"]').getAttribute('content'),
        /noindex/,
      )
      assert.ok(
        await page.evaluate(
          () =>
            document.documentElement.scrollWidth <=
            document.documentElement.clientWidth + 1,
        ), `${entry.id}: overflow a ${width}px`,
      )
      const diagram = page.locator('img[src*="/assets/visuals/architecture-boundaries/"]')
      assert.equal(await diagram.count(), 1)
      await diagram.scrollIntoViewIfNeeded()
      await page.waitForFunction(
        (element) => element.complete && element.naturalWidth > 0,
        await diagram.elementHandle(),
      )
      await diagram.evaluate((element) => element.decode())
      assert.ok(await diagram.evaluate((element) => element.naturalWidth > 0))
      if (width === 360)
        await page.screenshot({ path: `${folder}/${entry.id}-diagram.png` })
      for (const link of await page
        .locator('article a[href^="/posts/"],article a[href^="/assets/"]')
        .all()) {
        const href = await link.getAttribute('href')
        assert.equal((await page.request.get(origin + href)).status(), 200, href)
      }
      for (const pre of await page.locator('article pre').all()) {
        await pre.scrollIntoViewIfNeeded()
        if ((await pre.getAttribute('tabindex')) === '0') {
          await pre.focus()
          assert.ok(await pre.evaluate((element) => document.activeElement === element))
        }
      }
      for (const region of await page.getByRole('region').all()) {
        if ((await region.getAttribute('tabindex')) !== '0') continue
        await region.scrollIntoViewIfNeeded()
        await region.focus()
        assert.ok(await region.evaluate((element) => document.activeElement === element))
        if (
          width === 360 &&
          (await region.evaluate((element) => element.scrollWidth > element.clientWidth))
        ) {
          await region.press('ArrowRight')
          await page.waitForFunction(
            (element) => element.scrollLeft > 0,
            await region.elementHandle(),
          )
          await page.screenshot({ path: `${folder}/${entry.id}-table.png` })
        }
      }
      if (entry.id === 'P046' && width === 360) {
        const table = page.getByRole('region', { name: 'Comparación de costes entre un despliegue modular y servicios separados' })
        assert.equal(await table.count(), 1)
        await table.scrollIntoViewIfNeeded()
        await table.focus()
        await table.screenshot({ path: `${folder}/P046-comparison.png` })
        assert.ok(await table.evaluate((element) => element.scrollWidth > element.clientWidth))
        await table.press('ArrowRight')
        await page.waitForFunction((element) => element.scrollLeft > 0, await table.elementHandle())
      }
      await page.locator(`h1#${entry.slug}`).scrollIntoViewIfNeeded()
      await page.screenshot({
        path: `${folder}/${entry.id}-${width}.png`,
        fullPage: true,
      })
      report.push({ id: entry.id, width, status: 'passed' })
    }
  }
  assert.deepEqual(errors, [])
  await writeFile(`${folder}/report.json`, JSON.stringify(report, null, 2) + '\n')
  console.log(`${report.length} vistas verificadas: ${folder}/report.json`)
} finally {
  await browser.close()
}
