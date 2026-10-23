import assert from 'node:assert/strict'
import { readFile, mkdtemp, writeFile } from 'node:fs/promises'
import { chromium } from '@playwright/test'

const origin = process.env.PERFORMANCE_DRAFT_ORIGIN ?? 'http://127.0.0.1:4322'
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(origin).hostname))
const manifest = JSON.parse(
  await readFile('docs/editorial/performance-series.json'),
)
const folder = await mkdtemp('/tmp/performance-layout.')
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
      const diagram = page.locator('img[src*="/assets/visuals/performance/"]')
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
      const charts = await page.locator('article img[src*="/interactive/performance-series/"]').all()
      for (const [index, chart] of charts.entries()) {
        await chart.scrollIntoViewIfNeeded()
        await chart.evaluate((element) => element.decode())
        if (width === 360) await page.screenshot({ path: `${folder}/${entry.id}-chart-${index}.png` })
      }
      if (entry.id === 'PERF-SOAK') {
        const frame = page.locator('iframe[src*="performance-series/"]')
        await frame.scrollIntoViewIfNeeded()
        await page.frameLocator('iframe[src*="performance-series/"]').locator('#scenario:not([disabled])').waitFor({ state: 'visible' })
        assert.equal(await page.frameLocator('iframe[src*="performance-series/"]').locator('#scenario').inputValue(), 'steady-60s')
      }
      const tableRegions = await page.locator('article [role="region"]:has(table)').all()
      assert.equal(tableRegions.length, await page.locator('article table').count())
      for (const [index, region] of tableRegions.entries()) {
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
          await page.screenshot({ path: `${folder}/${entry.id}-table-${index}.png` })
        }
      }
      await page.locator(`h1#${entry.slug}`).scrollIntoViewIfNeeded()
      await page.screenshot({
        path: `${folder}/${entry.id}-${width}.png`,
        fullPage: true,
      })
      report.push({ id: entry.id, width, status: 'passed' })
    }
  }
  for (const width of [1440, 360]) {
    await page.setViewportSize({ width, height: 1000 })
    await page.goto(`${origin}/assets/interactive/performance-series/explorer.html?stage=steady-60s`, { waitUntil: 'networkidle' })
    const measurements = await (await page.request.get(`${origin}/assets/interactive/performance-series/measurements.json`)).json()
    for (const stage of measurements.stages) {
      await page.locator('#scenario').selectOption(stage.name)
      const counts = await page.locator('#metrics dd').allTextContents()
      const parseNumber = (s) => Number(s.replaceAll('.', '').replace(',', '.'))
      assert.deepEqual(counts.slice(0, 4).map(parseNumber), [stage.requests, stage.successes, stage.errors, stage.dropped])
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1))
      if (stage.dropped > 0) assert.match(await page.locator('#note').textContent(), /No son respuestas HTTP 503/)
      if (stage.name === 'steady-60s') {
        assert.equal(await page.locator('#rows tr').count(), 6)
        assert.match(await page.locator('#rows tr').last().textContent(), /Parcial/)
      }
    }
    await page.locator('#scenario').focus()
    await page.locator('#scenario').press('Home')
    await page.locator('#scenario').press('ArrowDown')
    await page.locator('#scenario').press('Enter')
    assert.equal(await page.locator('#scenario').inputValue(), measurements.stages[1].name)
    await page.locator('#scenario').selectOption('steady-60s')
    const region = page.locator('#windows [role="region"]')
    await region.scrollIntoViewIfNeeded()
    await region.focus()
    if (width === 360) {
      await region.press('ArrowRight')
      await page.waitForFunction((element) => element.scrollLeft > 0, await region.elementHandle())
    }
    await page.screenshot({ path: `${folder}/explorer-${width}.png`, fullPage: true })
    report.push({ id: 'explorer', width, status: 'passed', selections: measurements.stages.length })
  }
  assert.deepEqual(errors, [])
  await writeFile(`${folder}/report.json`, JSON.stringify(report, null, 2) + '\n')
  console.log(`${report.length} vistas verificadas: ${folder}/report.json`)
} finally {
  await browser.close()
}
