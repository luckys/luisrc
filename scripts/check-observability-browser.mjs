import assert from 'node:assert/strict'
import { readFile, mkdtemp, writeFile } from 'node:fs/promises'
import { chromium } from '@playwright/test'

const origin = process.env.OBSERVABILITY_DRAFT_ORIGIN ?? 'http://127.0.0.1:4322'
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(origin).hostname))
const manifest = JSON.parse(await readFile('docs/editorial/observability-series.json'))
const data = JSON.parse(await readFile('public/assets/interactive/observability-series/measurements.json'))
const folder = await mkdtemp('/tmp/observability-layout.')
const report = []
const browser = await chromium.launch({ headless: true })
try {
  const page = await browser.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(String(error)))
  for (const width of [1440, 360]) {
    await page.setViewportSize({ width, height: 1000 })
    for (const entry of manifest.articles) {
      const response = await page.goto(`${origin}/posts/${entry.slug}`, { waitUntil: 'networkidle' })
      assert.equal(response.status(), 200)
      assert.equal((await page.locator(`h1#${entry.slug}`).textContent()).trim(), `# ${entry.title}`)
      assert.match(await page.locator('meta[name="robots"]').getAttribute('content'), /noindex/)
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${entry.id}: overflow a ${width}px`)
      const diagram = page.locator('img[src*="/assets/visuals/observability/"]')
      assert.equal(await diagram.count(), 1)
      await diagram.scrollIntoViewIfNeeded()
      await page.waitForFunction((element) => element.complete && element.naturalWidth > 0, await diagram.elementHandle())
      await diagram.evaluate((element) => element.decode())
      if (width === 360) await page.screenshot({ path: `${folder}/${entry.id}-diagram.png` })
      for (const link of await page.locator('article a[href^="/posts/"],article a[href^="/assets/"]').all()) {
        const href = await link.getAttribute('href')
        assert.equal((await page.request.get(origin + href)).status(), 200, href)
      }
      for (const pre of await page.locator('article pre[tabindex="0"]').all()) {
        await pre.scrollIntoViewIfNeeded(); await pre.focus()
        assert.ok(await pre.evaluate((element) => document.activeElement === element))
      }
      if (entry.id === 'OBS-EXEMPLARS') {
        const chart = page.locator('article img[src*="/interactive/observability-series/"]')
        await chart.scrollIntoViewIfNeeded(); await chart.evaluate((element) => element.decode())
        if (width === 360) await page.screenshot({ path: `${folder}/chart-${width}.png` })
        await page.locator('iframe[src*="observability-series/"]').scrollIntoViewIfNeeded()
        await page.frameLocator('iframe[src*="observability-series/"]').locator('#scenario:not([disabled])').waitFor({ state: 'visible' })
        assert.equal(await page.frameLocator('iframe[src*="observability-series/"]').locator('#scenario').inputValue(), 'ok')
      }
      await page.locator(`h1#${entry.slug}`).scrollIntoViewIfNeeded()
      await page.screenshot({ path: `${folder}/${entry.id}-${width}.png`, fullPage: true })
      report.push({ id: entry.id, width, status: 'passed' })
    }
    const viewerRequests = []
    const listener = (request) => viewerRequests.push(request.url())
    page.on('request', listener)
    await page.goto(origin + '/assets/interactive/observability-series/explorer.html', { waitUntil: 'networkidle' })
    await page.locator('#scenario:not([disabled])').waitFor({ state: 'visible' })
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
    assert.equal(await page.locator('#histogram tr').count(), 2)
    for (const [i, point] of data.metrics.histogram.entries()) {
      const cells = await page.locator('#histogram tr').nth(i).locator('td').allTextContents()
      assert.deepEqual(cells.slice(1, 6).map(Number), point.value.buckets.counts)
    }
    for (const entry of data.cases) {
      await page.selectOption('#scenario', entry.scenario)
      assert.equal(await page.locator('#spans tr').count(), entry.spans.length)
      assert.equal(await page.locator('#logs tr').count(), 2)
      assert.ok((await page.locator('#summary').textContent()).includes(entry.job.operationId))
      assert.equal(await page.locator('#timeline rect').count(), entry.spans.length)
    }
    await page.locator('#scenario').focus()
    await page.keyboard.press('Home'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter')
    assert.equal(await page.locator('#scenario').inputValue(), 'fail')
    const buttons = await page.locator('#exemplars button').all()
    assert.equal(buttons.length, data.metrics.exemplars.length)
    for (const button of buttons) {
      await button.focus(); await button.press('Enter')
      assert.equal(await page.locator('#spans tr.selected').count(), 1)
      assert.match(await page.locator('#selection').textContent(), /Exemplar localizado/)
    }
    for (const [i, region] of (await page.locator('[role="region"]').all()).entries()) {
      await region.scrollIntoViewIfNeeded(); await region.focus()
      assert.ok(await region.evaluate((element) => document.activeElement === element))
      if (width === 360) {
        await region.press('ArrowRight')
        await page.waitForFunction((element) => element.scrollLeft > 0, await region.elementHandle())
        await page.screenshot({ path: `${folder}/viewer-region-${i}-${width}.png` })
      }
    }
    assert.ok(viewerRequests.every((url) => url.startsWith(origin + '/assets/interactive/observability-series/')))
    page.off('request', listener)
    await page.screenshot({ path: `${folder}/viewer-${width}.png`, fullPage: true })
    report.push({ id: 'viewer', width, scenarios: 5, exemplarSelections: buttons.length, status: 'passed' })
  }
  assert.deepEqual(errors, [])
  await writeFile(`${folder}/report.json`, JSON.stringify(report, null, 2))
  console.log(`${report.length} vistas verificadas: ${folder}/report.json`)
} finally { await browser.close() }
