import assert from 'node:assert/strict'
import { readFile, writeFile, mkdtemp } from 'node:fs/promises'
import { chromium } from '@playwright/test'

const origin = process.env.CONTAINER_DRAFT_ORIGIN ?? 'http://127.0.0.1:4322'
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(origin).hostname))
const manifest = JSON.parse(await readFile('docs/editorial/container-environments-series.json'))
const data = JSON.parse(await readFile('public/assets/interactive/container-environments/replay.json'))
const folder = await mkdtemp('/tmp/container-environments-layout.')
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
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), entry.id)
      for (const image of await page.locator('article img[src*="/container-environments/"]').all()) {
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
      for (const region of await page.locator('article [role="region"]:has(table)').all()) {
        await region.scrollIntoViewIfNeeded(); await region.focus(); assert.ok(await region.evaluate((e) => document.activeElement === e))
        if (width === 360 && await region.evaluate((e) => e.scrollWidth > e.clientWidth)) {
          await region.press('ArrowRight'); await page.waitForFunction((e) => e.scrollLeft > 0, await region.elementHandle())
          await page.screenshot({ path: `${folder}/${entry.id}-table.png` })
        }
      }
      if (entry.id === 'DOCKER-VOLUMES') {
        await page.locator('iframe[src*="container-environments/"]').scrollIntoViewIfNeeded()
        await page.frameLocator('iframe[src*="container-environments/"]').locator('#event:not([disabled])').waitFor({ state: 'visible' })
      }
      await page.locator(`h1#${entry.slug}`).scrollIntoViewIfNeeded()
      await page.screenshot({ path: `${folder}/${entry.id}-${width}.png`, fullPage: true })
      report.push({ id: entry.id, width, status: 'passed' })
    }
    const requests = [], listener = (r) => requests.push(r.url())
    page.on('request', listener)
    const base = origin + '/assets/interactive/container-environments/'
    assert.equal((await page.goto(base + 'explorer.html', { waitUntil: 'networkidle' })).status(), 200)
    await page.locator('#event:not([disabled])').waitFor({ state: 'visible' })
    assert.match(await page.locator('meta[name="robots"]').getAttribute('content'), /noindex/)
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
    assert.equal(await page.locator('#rows tbody tr').count(), 10)
    for (const e of data.events) {
      await page.selectOption('#event', e.id)
      const f = e.facts, show = (v) => v === undefined ? 'No capturado' : String(v)
      const expected = [f.rows ?? f.initialRows, f.finalRows, f.live?.status, f.ready?.status,
        f.fallback?.body?.source, f.security?.uid, f.sourceChangeInstallCached].map(show)
      assert.deepEqual(await page.locator('#snapshot td').allTextContents(), expected)
      assert.deepEqual(JSON.parse(await page.locator('#facts').textContent()), f)
      assert.ok((await page.locator('#summary').textContent()).startsWith(`#${e.seq} · ${e.id} · ${e.at}`))
      assert.equal(await page.locator('#graphic rect').count(), (f.rows ?? f.initialRows) === undefined ? 0 : 1)
      const index = data.events.indexOf(e)
      assert.equal(await page.locator('#previous').isDisabled(), index === 0)
      assert.equal(await page.locator('#next').isDisabled(), index === data.events.length - 1)
    }
    for (const [i, e] of data.events.entries()) {
      const cells = await page.locator('#rows tbody tr').nth(i).locator('td').allTextContents()
      assert.equal(cells[1], (e.facts.rows ?? e.facts.initialRows)?.toString() ?? 'No capturado')
      assert.equal(cells[2], e.facts.finalRows?.toString() ?? 'No capturado')
    }
    await page.locator('#event').focus(); await page.locator('#event').press('Home'); await page.locator('#event').press('Enter')
    assert.equal(await page.locator('#event').inputValue(), data.events[0].id)
    await page.locator('#next').focus(); await page.locator('#next').press('Enter')
    assert.equal(await page.locator('#event').inputValue(), data.events[1].id)
    await page.locator('#previous').focus(); await page.locator('#previous').press('Enter')
    assert.equal(await page.locator('#event').inputValue(), data.events[0].id)
    for (const region of await page.locator('[role="region"]').all()) {
      await region.scrollIntoViewIfNeeded(); await region.focus(); assert.ok(await region.evaluate((e) => document.activeElement === e))
      if (width === 360) { await region.press('ArrowRight'); await page.waitForFunction((e) => e.scrollLeft > 0, await region.elementHandle()) }
      await region.evaluate((e) => { e.scrollLeft = 0 })
    }
    await page.locator('details summary').focus(); await page.locator('details summary').press('Enter')
    assert.ok(await page.locator('details').evaluate((e) => e.open))
    await page.locator('details summary').press('Enter')
    await page.selectOption('#event', 'second_fresh_setup')
    await page.locator('h1').scrollIntoViewIfNeeded()
    await page.waitForTimeout(200)
    for (const region of await page.locator('[role="region"]').all()) {
      await region.evaluate((e) => e.scrollTo({ left: 0, behavior: 'instant' }))
      assert.equal(await region.evaluate((e) => e.scrollLeft), 0)
    }
    await page.screenshot({ path: `${folder}/viewer-${width}.png`, fullPage: true })
    assert.ok(requests.every((url) => url.startsWith(base)), requests.join('\n'))
    page.off('request', listener)
    report.push({ id: 'viewer', width, status: 'passed', events: data.events.length, keyboard: true, staticOnly: true })
  }
  assert.deepEqual(errors, [])
  await writeFile(`${folder}/report.json`, JSON.stringify({ report, errors }, null, 2) + '\n')
  console.log(`${report.length} vistas verificadas: ${folder}/report.json`)
} finally { await browser.close() }
