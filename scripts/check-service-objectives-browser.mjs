import assert from 'node:assert/strict'
import { readFile, mkdtemp, writeFile } from 'node:fs/promises'
import { chromium } from '@playwright/test'
import { WindowIndex, expand, evaluateAlerts, classifyCohorts } from '../public/assets/interactive/service-objectives/model.mjs'
const origin = process.env.SERVICE_OBJECTIVES_DRAFT_ORIGIN ?? 'http://127.0.0.1:4322'
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(origin).hostname))
const manifest = JSON.parse(await readFile('docs/editorial/service-objectives-series.json'))
const data = JSON.parse(await readFile('public/assets/interactive/service-objectives/scenarios.json'))
const folder = await mkdtemp('/tmp/service-objectives-layout.')
const report = [], errors = []
const browser = await chromium.launch({ headless: true })
try {
  const page = await browser.newPage()
  page.on('pageerror', (error) => errors.push(String(error)))
  for (const width of [1440, 360]) {
    await page.setViewportSize({ width, height: 1000 })
    for (const entry of manifest.articles) {
      assert.equal((await page.goto(`${origin}/posts/${entry.slug}`, { waitUntil: 'networkidle' })).status(), 200)
      assert.equal((await page.locator(`h1#${entry.slug}`).textContent()).trim(), `# ${entry.title}`)
      assert.match(await page.locator('meta[name="robots"]').getAttribute('content'), /noindex/)
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
      const image = page.locator('img[src*="/assets/visuals/service-objectives/"]')
      assert.equal(await image.count(), 1)
      await image.scrollIntoViewIfNeeded()
      await page.waitForFunction((e) => e.complete && e.naturalWidth > 0, await image.elementHandle())
      await image.evaluate((e) => e.decode())
      if (width === 360) await page.screenshot({ path: `${folder}/${entry.id}-diagram.png` })
      for (const link of await page.locator('article a[href^="/posts/"],article a[href^="/assets/"]').all()) assert.equal((await page.request.get(origin + await link.getAttribute('href'))).status(), 200)
      for (const pre of await page.locator('article pre[tabindex="0"]').all()) { await pre.scrollIntoViewIfNeeded(); await pre.focus(); assert.ok(await pre.evaluate((e) => document.activeElement === e)) }
      for (const region of await page.locator('article [role="region"]:has(table)').all()) {
        await region.scrollIntoViewIfNeeded(); await region.focus()
        if (width === 360 && await region.evaluate((e) => e.scrollWidth > e.clientWidth)) { await region.press('ArrowRight'); await page.waitForFunction((e) => e.scrollLeft > 0, await region.elementHandle()); await page.screenshot({ path: `${folder}/${entry.id}-table.png` }) }
      }
      if (entry.id === 'SLO-BURN') {
        const chart = page.locator('article img[src*="/interactive/service-objectives/"]')
        await chart.scrollIntoViewIfNeeded()
        await page.waitForFunction((e) => e.complete && e.naturalWidth > 0, await chart.elementHandle())
        await chart.evaluate((e) => e.decode())
        if (width === 360) await page.screenshot({ path: `${folder}/chart-360.png` })
      }
      if (entry.id === 'SLO-ALERTS') { await page.locator('iframe[src*="service-objectives/"]').scrollIntoViewIfNeeded(); await page.frameLocator('iframe[src*="service-objectives/"]').locator('#scenario:not([disabled])').waitFor({ state: 'visible' }) }
      await page.locator(`h1#${entry.slug}`).scrollIntoViewIfNeeded()
      await page.screenshot({ path: `${folder}/${entry.id}-${width}.png`, fullPage: true })
      report.push({ id: entry.id, width, status: 'passed' })
    }
    const requests = [], listener = (r) => requests.push(r.url())
    page.on('request', listener)
    await page.goto(origin + '/assets/interactive/service-objectives/explorer.html', { waitUntil: 'networkidle' })
    await page.locator('#scenario:not([disabled])').waitFor({ state: 'visible' })
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
    assert.equal(await page.locator('#chart').getAttribute('viewBox'), `0 0 ${width === 360 ? 380 : 760} 300`)
    assert.ok(await page.locator('#chart').evaluate((e) => e.getBoundingClientRect().width <= e.parentElement.clientWidth + 1))
    let combinations = 0
    for (const scenario of data.scenarios) {
      await page.selectOption('#scenario', scenario.id)
      for (const target of [990000, 999000, 999500, 999900]) {
        await page.selectOption('#target', String(target))
        const expected = evaluateAlerts(new WindowIndex(expand(scenario)), 43200, target)
        for (const [i, pair] of expected.pairs.entries()) assert.equal((await page.locator('#pairs tr').nth(i).locator('td').allTextContents())[3], pair.state)
        if (scenario.id === 'missing-data') assert.match(await page.locator('#summary').textContent(), /Cobertura incompleta/)
        if (scenario.id === 'no-traffic') assert.match(await page.locator('#summary').textContent(), /no definidos/)
        combinations++
      }
    }
    await page.selectOption('#scenario', 'fast-burn'); await page.selectOption('#target', '999000')
    const budget = (await page.locator('#summary').textContent()).split('Condición')[0]
    await page.locator('#clock').focus(); await page.locator('#clock').press('Home')
    assert.equal((await page.locator('#pairs tr').first().locator('td').allTextContents())[3], 'ok')
    assert.equal((await page.locator('#summary').textContent()).split('Condición')[0], budget)
    await page.locator('#clock').press('End')
    assert.equal((await page.locator('#pairs tr').first().locator('td').allTextContents())[3], 'firing')
    for (const id of ['fast', 'slow', 'ticket']) await page.selectOption('#rule', id)
    await page.locator('#rule').focus(); await page.locator('#rule').press('Home'); await page.locator('#rule').press('ArrowDown'); await page.locator('#rule').press('Enter')
    assert.equal(await page.locator('#rule').inputValue(), 'slow')
    for (const now of [0, 5, 10, 14, 17]) {
      const slider = page.locator('#cohort-clock'); await slider.focus(); await slider.press('Home')
      for (let i = 0; i < now; i++) await slider.press('ArrowRight')
      assert.equal(await slider.inputValue(), String(now))
      const expected = classifyCohorts(data.operations, now, 5)
      assert.ok((await page.locator('#cohort-summary').textContent()).includes(`Elegibles ${expected.eligible}; buenas ${expected.good};`))
      assert.deepEqual(await page.locator('#cohorts tr td:last-child').allTextContents(), expected.rows.map((r) => r.classification))
    }
    for (const [i, region] of (await page.locator('[role="region"]').all()).entries()) {
      await region.scrollIntoViewIfNeeded(); await region.focus(); assert.ok(await region.evaluate((e) => document.activeElement === e))
      if (width === 360) {
        if (await region.evaluate((e) => e.scrollWidth > e.clientWidth)) {
          await region.press('ArrowRight')
          await page.waitForFunction((e) => e.scrollLeft > 0, await region.elementHandle())
        }
        await page.screenshot({ path: `${folder}/viewer-region-${i}-360.png` })
      }
    }
    assert.ok(requests.every((url) => url.startsWith(origin + '/assets/interactive/service-objectives/')))
    page.off('request', listener)
    await page.screenshot({ path: `${folder}/viewer-${width}.png`, fullPage: true })
    report.push({ id: 'viewer', width, combinations, cohortSnapshots: 5, status: 'passed' })
  }
  assert.deepEqual(errors, [])
  await writeFile(`${folder}/report.json`, JSON.stringify(report, null, 2))
  console.log(`${report.length} vistas verificadas: ${folder}/report.json`)
} finally { await browser.close() }
