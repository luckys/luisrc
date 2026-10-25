import assert from 'node:assert/strict'
import { readFile, writeFile, mkdtemp } from 'node:fs/promises'
import { chromium } from '@playwright/test'
const origin = process.env.TERRAFORM_DRAFT_ORIGIN ?? 'http://127.0.0.1:4322'
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(origin).hostname))
const manifest = JSON.parse(await readFile('docs/editorial/terraform-series.json'))
const data = JSON.parse(await readFile('public/assets/interactive/declarative-infrastructure/replay.json'))
const folder = await mkdtemp('/tmp/terraform-layout.'), report = [], errors = []
const browser = await chromium.launch({ headless: true })
try {
  const page = await browser.newPage(); page.on('pageerror', (error) => errors.push(String(error)))
  for (const width of [1440, 360]) {
    await page.setViewportSize({ width, height: 1000 })
    for (const entry of manifest.articles) {
      assert.equal((await page.goto(origin + '/posts/' + entry.slug, { waitUntil: 'networkidle' })).status(), 200)
      assert.equal((await page.locator('h1#' + entry.slug).textContent()).trim(), '# ' + entry.title)
      assert.match(await page.locator('meta[name="robots"]').getAttribute('content'), /noindex/)
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), entry.id + '@' + width)
      for (const image of await page.locator('article img[src*="/terraform/"],article img[src*="/declarative-infrastructure/"]').all()) {
        await image.scrollIntoViewIfNeeded(); await page.waitForFunction((e) => e.complete && e.naturalWidth > 0, await image.elementHandle())
        if (width === 360) await page.screenshot({ path: folder + '/' + entry.id + '-image-' + (await image.getAttribute('src')).split('/').at(-1) + '.png' })
      }
      for (const link of await page.locator('article a[href^="/posts/"],article a[href^="/assets/"]').all()) assert.equal((await page.request.get(origin + await link.getAttribute('href'))).status(), 200)
      for (const pre of await page.locator('article pre[tabindex="0"]').all()) {
        await pre.scrollIntoViewIfNeeded(); await pre.focus(); assert.ok(await pre.evaluate((e) => document.activeElement === e))
      }
      if (entry.id === 'TF-CHANGES') {
        await page.locator('iframe').scrollIntoViewIfNeeded(); await page.frameLocator('iframe').locator('#event:not([disabled])').waitFor({ state: 'visible' })
      }
      await page.locator('h1#' + entry.slug).scrollIntoViewIfNeeded(); await page.screenshot({ path: folder + '/' + entry.id + '-' + width + '.png', fullPage: true })
      report.push({ id: entry.id, width, status: 'passed' })
    }
    const base = origin + '/assets/interactive/declarative-infrastructure/', requests = []
    const listener = (r) => requests.push(r.url()); page.on('request', listener)
    assert.equal((await page.goto(base + 'explorer.html', { waitUntil: 'networkidle' })).status(), 200)
    await page.locator('#event:not([disabled])').waitFor()
    assert.match(await page.locator('meta[name="robots"]').getAttribute('content'), /noindex/)
    for (const [i, event] of data.events.entries()) {
      await page.selectOption('#event', String(i)); const f = event.facts, show = (v) => v === undefined ? 'No capturado' : String(v)
      const expected = [f.http?.status, f.http?.body.message, f.resourcesInState, f.namespaceAbsent, f.stateContainsDummyValue, f.reason].map(show)
      assert.deepEqual(await page.locator('#snapshot td:nth-child(2)').allTextContents(), expected)
      assert.deepEqual(JSON.parse(await page.locator('#facts').textContent()), f)
      assert.ok((await page.locator('#summary').textContent()).startsWith('#' + event.seq + ' · ' + event.id))
      const plan = f.normalPlan ?? f.plan ?? f.terraformPlan ?? (f.counts ? f : undefined)
      assert.equal(await page.locator('#plan').isVisible(), Boolean(plan))
      if (plan) {
        assert.deepEqual(await page.locator('#changes tr').evaluateAll((rows) => rows.map((r) => [...r.cells].map((c) => c.textContent))), plan.changes.map((c) => [c.address, c.actions.join(' → ')]))
        const max = Math.max(plan.counts.create, plan.counts.update, plan.counts.delete, 1)
        for (const key of ['create', 'update', 'delete']) assert.ok(Math.abs(await page.locator('#' + key + '-bar').evaluate((e) => parseFloat(e.style.width)) - 100 * plan.counts[key] / max) < 0.001)
        assert.ok((await page.locator('#replacements').textContent()).includes(String(plan.counts.replace)))
      }
      assert.equal(await page.locator('#previous').isDisabled(), i === 0); assert.equal(await page.locator('#next').isDisabled(), i === data.events.length - 1)
    }
    await page.locator('#event').focus(); await page.locator('#event').press('Home'); await page.locator('#event').press('Enter')
    assert.equal(await page.locator('#event').inputValue(), '0')
    await page.locator('#next').focus(); await page.locator('#next').press('Enter'); assert.equal(await page.locator('#event').inputValue(), '1')
    await page.locator('#previous').focus(); await page.locator('#previous').press('Enter'); assert.equal(await page.locator('#event').inputValue(), '0')
    await page.selectOption('#event', '10')
    for (const region of await page.locator('[role="region"]').all()) {
      await region.scrollIntoViewIfNeeded(); await region.focus(); assert.ok(await region.evaluate((e) => document.activeElement === e))
      if (width === 360 && await region.evaluate((e) => e.scrollWidth > e.clientWidth + 2)) { await region.press('ArrowRight'); await page.waitForFunction((e) => e.scrollLeft > 0, await region.elementHandle()) }
    }
    await page.locator('summary').focus(); await page.locator('summary').press('Enter'); assert.equal(await page.locator('details').evaluate((e) => e.open), true)
    await page.locator('#facts').focus(); assert.ok(await page.locator('#facts').evaluate((e) => document.activeElement === e))
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
    await page.waitForTimeout(250)
    for (const region of await page.locator('[role="region"]').all()) {
      await region.evaluate((e) => e.scrollTo({ left: 0, behavior: 'instant' })); await page.waitForFunction((e) => e.scrollLeft === 0, await region.elementHandle())
    }
    page.off('request', listener); assert.ok(requests.every((url) => url.startsWith(base)), requests.join('\n'))
    await page.locator('h1').scrollIntoViewIfNeeded(); await page.screenshot({ path: folder + '/viewer-' + width + '.png', fullPage: true })
    report.push({ id: 'viewer', width, phases: data.events.length, status: 'passed' })
  }
  await page.route('**/declarative-infrastructure/replay.json', (route) => route.abort())
  await page.goto(origin + '/assets/interactive/declarative-infrastructure/explorer.html', { waitUntil: 'networkidle' })
  assert.match(await page.locator('#error').textContent(), /No se pudo cargar la captura/); assert.equal(await page.locator('#event').isDisabled(), true)
  assert.deepEqual(errors, [])
  await writeFile(folder + '/report.json', JSON.stringify({ report, missingReport: 'explicit_error', errors }, null, 2))
  console.log(JSON.stringify({ folder, views: report.length, errors }))
} finally { await browser.close() }
