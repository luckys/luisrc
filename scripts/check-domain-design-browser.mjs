import assert from 'node:assert/strict'
import { readFile, mkdtemp, writeFile } from 'node:fs/promises'
import { chromium } from '@playwright/test'

const origin = process.env.DOMAIN_DRAFT_ORIGIN ?? 'http://127.0.0.1:4322'
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(origin).hostname))
const manifest = JSON.parse(await readFile('docs/editorial/domain-design-series.json'))
const requested = process.env.DOMAIN_DRAFT_IDS?.split(',')
const entries = requested
  ? manifest.articles.filter((entry) => requested.includes(entry.id))
  : manifest.articles
if (requested)
  assert.deepEqual(entries.map((entry) => entry.id).toSorted(), requested.toSorted())
const folder = await mkdtemp('/tmp/domain-design-layout.')
const report = []
const browser = await chromium.launch({ headless: true })
try {
  const page = await browser.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(String(error)))
  for (const width of [1440, 360]) {
    await page.setViewportSize({ width, height: 1000 })
    for (const entry of entries) {
      assert.equal(
        (
          await page.goto(`${origin}/posts/${entry.slug}`, { waitUntil: 'networkidle' })
        ).status(),
        200,
      )
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
        ),
        `${entry.id}: page overflow`,
      )
      for (const image of await page
        .locator('img[src*="/assets/visuals/domain-design/"]')
        .all()) {
        await image.scrollIntoViewIfNeeded()
        await page.waitForFunction(
          (element) => element.complete && element.naturalWidth > 0,
          await image.elementHandle(),
        )
        await image.evaluate((element) => element.decode())
        if (width === 360)
          await page.screenshot({
            path: `${folder}/${(await image.getAttribute('src')).split('/').at(-1)}-mobile.png`,
          })
      }
      for (const region of await page.getByRole('region').all()) {
        if ((await region.getAttribute('tabindex')) !== '0') continue
        await region.scrollIntoViewIfNeeded()
        await region.focus()
        assert.ok(await region.evaluate((element) => element === document.activeElement))
        if (
          width === 360 &&
          (await region.evaluate((element) => element.scrollWidth > element.clientWidth))
        ) {
          await region.press('ArrowRight')
          await page.waitForFunction(
            (element) => element.scrollLeft > 0,
            await region.elementHandle(),
          )
        }
      }
      for (const link of await page
        .locator('article a[href^="/posts/"],article a[href^="/assets/"]')
        .all()) {
        const href = await link.getAttribute('href')
        assert.equal((await page.request.get(origin + href)).status(), 200, href)
      }
      await page.locator(`h1#${entry.slug}`).scrollIntoViewIfNeeded()
      await page.screenshot({
        path: `${folder}/${entry.id}-${width}.png`,
        fullPage: true,
      })
      report.push({ id: entry.id, width, status: 'passed' })
    }
    await page.goto(`${origin}/assets/interactive/domain-design/explorer.html`, {
      waitUntil: 'networkidle',
    })
    const slider = page.getByRole('slider')
    await slider.focus()
    await slider.press('ArrowRight')
    await page.waitForFunction(
      () => document.querySelector('#revision').textContent === '1',
    )
    assert.match(await page.locator('#reserved').textContent(), /70,00/)
    await slider.press('ArrowRight')
    assert.match(await page.locator('#label').textContent(), /conflict/)
    assert.equal(await page.locator('#events').textContent(), '1')
    await slider.press('End')
    assert.match(await page.locator('#label').textContent(), /rechaza/)
    await page.getByRole('combobox').selectOption('within-limit')
    assert.equal(await slider.inputValue(), '0')
    await slider.focus()
    await slider.press('End')
    assert.equal(await page.locator('#revision').textContent(), '2')
    assert.match(await page.locator('#reserved').textContent(), /50,00/)
    assert.equal(await page.locator('#events').textContent(), '2')
    assert.ok(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    )
    assert.equal(await page.locator('[aria-live="polite"]').count(), 1)
    await page.screenshot({ path: `${folder}/viewer-${width}.png`, fullPage: true })
    report.push({ widget: 'refund-traces', width, keyboard: 'passed' })
  }
  assert.deepEqual(errors, [])
  await writeFile(`${folder}/report.json`, JSON.stringify(report, null, 2) + '\n')
  console.log(`${report.length} comprobaciones de páginas y visor: ${folder}/report.json`)
} finally {
  await browser.close()
}
