import assert from 'node:assert/strict'
import { readFile, writeFile, mkdtemp } from 'node:fs/promises'
import { chromium } from '@playwright/test'

const origin = process.env.DELIVERY_DRAFT_ORIGIN ?? 'http://127.0.0.1:4322'
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(origin).hostname))
const manifest = JSON.parse(await readFile('docs/editorial/progressive-delivery-series.json'))
const data = JSON.parse(await readFile('public/assets/interactive/progressive-delivery/replay.json'))
const folder = await mkdtemp('/tmp/progressive-delivery-layout.')
const report = [], errors = []
const browser = await chromium.launch({ headless: true })
try {
  const page = await browser.newPage()
  page.on('pageerror', (e) => errors.push(String(e)))
  for (const width of [1440, 360]) {
    await page.setViewportSize({ width, height: 1000 })
    for (const entry of manifest.articles) {
      assert.equal((await page.goto(`${origin}/posts/${entry.slug}`, { waitUntil: 'networkidle' })).status(), 200)
      assert.equal((await page.locator(`h1#${entry.slug}`).textContent()).trim(), `# ${entry.title}`)
      assert.match(await page.locator('meta[name="robots"]').getAttribute('content'), /noindex/)
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${entry.id}@${width}`)
      for (const image of await page.locator('article img[src*="/progressive-delivery/"]').all()) {
        await image.scrollIntoViewIfNeeded()
        await page.waitForFunction((e) => e.complete && e.naturalWidth > 0, await image.elementHandle())
        await image.evaluate((e) => e.decode())
        if (width === 360) await page.screenshot({ path: `${folder}/${entry.id}-${(await image.getAttribute('src')).split('/').at(-1)}.png` })
      }
      for (const link of await page.locator('article a[href^="/posts/"],article a[href^="/assets/"]').all())
        assert.equal((await page.request.get(origin + await link.getAttribute('href'))).status(), 200)
      for (const pre of await page.locator('article pre[tabindex="0"]').all()) {
        await pre.scrollIntoViewIfNeeded(); await pre.focus(); assert.ok(await pre.evaluate((e) => document.activeElement === e))
      }
      if (entry.id === 'CD-CANARY') {
        await page.locator('iframe[src*="progressive-delivery/"]').scrollIntoViewIfNeeded()
        await page.frameLocator('iframe[src*="progressive-delivery/"]').locator('#event:not([disabled])').waitFor({ state: 'visible' })
      }
      await page.locator(`h1#${entry.slug}`).scrollIntoViewIfNeeded()
      await page.screenshot({ path: `${folder}/${entry.id}-${width}.png`, fullPage: true })
      report.push({ id: entry.id, width, status: 'passed' })
    }
    const requests = [], listener = (r) => requests.push(r.url()), base = origin + '/assets/interactive/progressive-delivery/'
    page.on('request', listener)
    assert.equal((await page.goto(base + 'explorer.html', { waitUntil: 'networkidle' })).status(), 200)
    await page.locator('#event:not([disabled])').waitFor({ state: 'visible' })
    assert.match(await page.locator('meta[name="robots"]').getAttribute('content'), /noindex/)
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
    for (const e of data.events) {
      await page.selectOption('#event', e.id)
      const f = e.facts, route = f.route?.route, show = (v) => v === undefined ? 'No capturado' : String(v)
      const rows = Array.isArray(f.afterRows) ? f.afterRows.length : Array.isArray(f.rows) ? f.rows.length : f.rows
      const expected = [route?.slots.join(', '), route?.canaryPercent, route?.featureEnabled, f.route?.revision, f.smoke?.ok, rows, f.negativeFixture].map(show)
      assert.deepEqual(await page.locator('#snapshot td').allTextContents(), expected)
      assert.deepEqual(JSON.parse(await page.locator('#facts').textContent()), f)
      assert.ok((await page.locator('#summary').textContent()).startsWith(`#${e.seq} · ${e.id} · ${e.at}`))
      assert.equal(await page.locator('#previous').isDisabled(), e.seq === 1)
      assert.equal(await page.locator('#next').isDisabled(), e.seq === data.events.length)
    }
    await page.locator('#event').focus(); await page.locator('#event').press('Home'); await page.locator('#event').press('Enter')
    assert.equal(await page.locator('#event').inputValue(), data.events[0].id)
    await page.locator('#next').focus(); await page.locator('#next').press('Enter')
    assert.equal(await page.locator('#event').inputValue(), data.events[1].id)
    await page.locator('#previous').focus(); await page.locator('#previous').press('Enter')
    assert.equal(await page.locator('#event').inputValue(), data.events[0].id)
    const all = data.events.find((e) => e.id === 'canary_exposed').facts.samples
    let pagesChecked = 0
    for (const cohort of ['all', 'candidate', 'control']) {
      await page.selectOption('#cohort', cohort)
      const selected = all.filter((s) => cohort === 'all' || (s.slot === 'green') === (cohort === 'candidate'))
      const http = selected.filter((s) => s.status === 200).length, good = selected.filter((s) => !s.bad).length
      assert.equal(await page.locator('#sample-summary').textContent(), `${selected.length} respuestas · ${http} HTTP 200 · ${good} precios correctos · ${selected.length - good} incorrectos`)
      const widths = await page.locator('#sample-chart rect').evaluateAll((nodes) => nodes.map((e) => +e.getAttribute('width')))
      assert.deepEqual(widths, [360 * http / selected.length, 360 * good / selected.length])
      let offset = 0
      while (offset < selected.length) {
        const expected = selected.slice(offset, offset + 12).map((s) => [s.bucket, s.slot, s.status, s.priceCents, s.bad ? 'Incorrecto' : 'Correcto', s.key].map(String))
        assert.deepEqual(await page.locator('#samples tbody tr').evaluateAll((rows) => rows.map((row) => [...row.cells].map((cell) => cell.textContent))), expected)
        assert.equal(await page.locator('#page-previous').isDisabled(), offset === 0)
        assert.equal(await page.locator('#page-next').isDisabled(), offset + 12 >= selected.length)
        pagesChecked++; offset += 12
        if (offset < selected.length) { await page.locator('#page-next').focus(); await page.locator('#page-next').press('Enter') }
      }
      await page.locator('#page-previous').focus(); await page.locator('#page-previous').press('Enter')
      assert.equal(await page.locator('#page-next').isDisabled(), false)
    }
    assert.equal(await page.locator('#gates tbody tr').count(), 8)
    for (const region of await page.locator('[role="region"]').all()) {
      await region.scrollIntoViewIfNeeded(); await region.focus(); assert.ok(await region.evaluate((e) => document.activeElement === e))
      if (width === 360) { await region.press('ArrowRight'); await page.waitForFunction((e) => e.scrollLeft > 0, await region.elementHandle()) }
    }
    await page.locator('details summary').focus(); await page.locator('details summary').press('Enter')
    assert.ok(await page.locator('details').evaluate((e) => e.open)); await page.locator('details summary').press('Enter')
    await page.selectOption('#event', 'canary_exposed'); await page.selectOption('#cohort', 'candidate')
    await page.waitForTimeout(200)
    for (const region of await page.locator('[role="region"]').all()) await region.evaluate((e) => e.scrollTo({ left: 0, behavior: 'instant' }))
    await page.locator('h1').scrollIntoViewIfNeeded(); await page.screenshot({ path: `${folder}/viewer-${width}.png`, fullPage: true })
    assert.ok(requests.every((url) => url.startsWith(base)), requests.join('\n')); page.off('request', listener)
    report.push({ id: 'viewer', width, status: 'passed', events: 18, filters: 3, pagesChecked, keyboard: true, staticOnly: true })
  }
  assert.deepEqual(errors, [])
  await writeFile(`${folder}/report.json`, JSON.stringify({ report, errors }, null, 2) + '\n')
  console.log(`${report.length} vistas verificadas: ${folder}/report.json`)
} finally { await browser.close() }
