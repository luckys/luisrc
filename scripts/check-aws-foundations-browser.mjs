import assert from 'node:assert/strict'
import { readFile, writeFile, mkdtemp } from 'node:fs/promises'
import { chromium } from '@playwright/test'
import { estimate } from '../public/assets/interactive/aws-foundations/cost-model.mjs'
const origin = process.env.AWS_DRAFT_ORIGIN ?? 'http://127.0.0.1:4322'
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(origin).hostname))
const manifest = JSON.parse(await readFile('docs/editorial/aws-foundations-series.json'))
const data = JSON.parse(await readFile('public/assets/interactive/aws-foundations/comparison.json'))
const folder = await mkdtemp('/tmp/aws-foundations-layout.'), report = [], errors = []
const format = (v) => v.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 8 })
const browser = await chromium.launch({ headless: true })
try {
  const page = await browser.newPage()
  page.on('pageerror', (error) => errors.push(String(error)))
  for (const width of [1440, 360]) {
    await page.setViewportSize({ width, height: 1000 })
    for (const entry of manifest.articles) {
      assert.equal((await page.goto(origin + '/posts/' + entry.slug, { waitUntil: 'networkidle' })).status(), 200)
      assert.equal((await page.locator('h1#' + entry.slug).textContent()).trim(), '# ' + entry.title)
      assert.match(await page.locator('meta[name="robots"]').getAttribute('content'), /noindex/)
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), entry.id + '@' + width)
      for (const image of await page.locator('article img[src*="/aws-foundations/"]').all()) {
        await image.scrollIntoViewIfNeeded()
        await page.waitForFunction((e) => e.complete && e.naturalWidth > 0, await image.elementHandle())
        if (width === 360) await page.screenshot({ path: folder + '/' + entry.id + '-diagram-' + (await image.getAttribute('src')).split('/').at(-1) + '.png' })
      }
      for (const link of await page.locator('article a[href^="/posts/"],article a[href^="/assets/"]').all())
        assert.equal((await page.request.get(origin + await link.getAttribute('href'))).status(), 200, await link.getAttribute('href'))
      for (const pre of await page.locator('article pre[tabindex="0"]').all()) {
        await pre.scrollIntoViewIfNeeded(); await pre.focus(); assert.ok(await pre.evaluate((e) => document.activeElement === e))
      }
      for (const region of await page.locator('article [role="region"]').all()) {
        await region.scrollIntoViewIfNeeded(); await region.focus(); assert.ok(await region.evaluate((e) => document.activeElement === e))
        if (await region.evaluate((e) => e.scrollWidth > e.clientWidth + 2)) {
          await region.press('ArrowRight'); await page.waitForFunction((e) => e.scrollLeft > 0, await region.elementHandle())
          await region.evaluate((e) => e.scrollTo({ left: 0, behavior: 'instant' }))
        }
      }
      if (entry.id === 'AWS-CHOICE') {
        await page.locator('iframe').scrollIntoViewIfNeeded()
        await page.frameLocator('iframe').locator('#scenario:not([disabled])').waitFor({ state: 'visible' })
      }
      await page.locator('h1#' + entry.slug).scrollIntoViewIfNeeded()
      await page.screenshot({ path: folder + '/' + entry.id + '-' + width + '.png', fullPage: true })
      report.push({ id: entry.id, width, status: 'passed' })
    }
    const base = origin + '/assets/interactive/aws-foundations/', requests = []
    const listener = (r) => requests.push(r.url()); page.on('request', listener)
    assert.equal((await page.goto(base + 'explorer.html', { waitUntil: 'networkidle' })).status(), 200)
    await page.locator('#scenario:not([disabled])').waitFor()
    assert.match(await page.locator('meta[name="robots"]').getAttribute('content'), /noindex/)
    const assertResult = async (input) => {
      const result = estimate(input, data.pricing.rates)
      for (const key of ['lambda', 'ecs']) assert.equal(await page.locator('#' + key + 'Total').textContent(), format(result[key].subtotal) + ' USD')
      assert.deepEqual(await page.locator('#lines tr td:last-child').allTextContents(), ['lambda', 'ecs'].flatMap((key) => Object.values(result[key].lines).map(format)))
      const max = Math.max(result.lambda.subtotal, result.ecs.subtotal, 0.00000001)
      for (const key of ['lambda', 'ecs']) {
        const value = await page.locator('#' + key + 'Bar').evaluate((e) => parseFloat(e.style.width))
        assert.ok(Math.abs(value - 100 * result[key].subtotal / max) < 0.001)
      }
      assert.equal(await page.locator('#result').isVisible(), true); assert.equal(await page.locator('#error').isVisible(), false)
    }
    for (const [i, c] of data.cases.entries()) {
      await page.selectOption('#scenario', String(i)); await assertResult(c.input)
      assert.equal(await page.locator('#scenario option:checked').textContent(), c.name)
      assert.equal(await page.locator('#scenario-name').textContent(), c.name)
    }
    await page.selectOption('#scenario', '0')
    let input = { ...data.cases[0].input }
    for (const [id, value] of [['requests', 2000000], ['memoryMb', 1024], ['billedMs', 200], ['tasks', 3], ['assumedLcu', 5], ['interfaceGb', 120]]) {
      await page.fill('#' + id, String(value)); input[id] = value; await assertResult(input)
    }
    await page.selectOption('#shape', '0.5,1'); input.taskVcpu = 0.5; input.taskMemoryGb = 1; await assertResult(input)
    await page.fill('#requests', '0'); input.requests = 0; await assertResult(input)
    for (const [id, value] of [['requests', ''], ['requests', '-1'], ['requests', '300000001']]) {
      await page.fill('#' + id, value); assert.equal(await page.locator('#error').isVisible(), true); assert.equal(await page.locator('#result').isVisible(), false)
    }
    await page.locator('#reset').focus(); await page.locator('#reset').press('Enter'); await assertResult(data.cases[0].input)
    await page.locator('#requests').focus(); await page.locator('#requests').press('ArrowUp'); await assertResult({ ...data.cases[0].input, requests: 1000001 })
    await page.locator('#reset').click()
    for (const summary of await page.locator('details summary').all()) { await summary.focus(); await summary.press('Enter') }
    assert.deepEqual(await page.locator('#observations tr td:nth-child(2)').allTextContents(), ['200', '404', '405', '503'])
    assert.match(await page.locator('#contracts').textContent(), /Restauración RDS verificada: no/)
    for (const region of await page.locator('[role="region"]').all()) {
      await region.scrollIntoViewIfNeeded(); await region.focus(); assert.ok(await region.evaluate((e) => document.activeElement === e))
      if (width === 360) { await region.press('ArrowRight'); await page.waitForFunction((e) => e.scrollLeft > 0, await region.elementHandle()) }
      await region.evaluate((e) => e.scrollTo({ left: 0, behavior: 'instant' }))
    }
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
    await page.waitForTimeout(250)
    for (const region of await page.locator('[role="region"]').all()) {
      await region.evaluate((e) => e.scrollTo({ left: 0, behavior: 'instant' }))
      await page.waitForFunction((e) => e.scrollLeft === 0, await region.elementHandle())
    }
    page.off('request', listener)
    assert.ok(requests.every((url) => url.startsWith(base)), requests.join('\n'))
    await page.locator('h1').scrollIntoViewIfNeeded(); await page.screenshot({ path: folder + '/viewer-' + width + '.png', fullPage: true })
    report.push({ id: 'viewer', width, scenarios: 2, modifiedFields: 7, invalidStates: 3, status: 'passed' })
  }
  await page.route('**/aws-foundations/comparison.json', (route) => route.abort())
  await page.goto(origin + '/assets/interactive/aws-foundations/explorer.html', { waitUntil: 'networkidle' })
  assert.match(await page.locator('#error').textContent(), /No se pudo cargar el informe/)
  assert.equal(await page.locator('#result').isVisible(), false); assert.equal(await page.locator('#scenario').isDisabled(), true)
  assert.deepEqual(errors, [])
  await writeFile(folder + '/report.json', JSON.stringify({ report, missingReport: 'explicit_error_no_estimate', errors }, null, 2))
  console.log(JSON.stringify({ folder, views: report.length, errors }))
} finally { await browser.close() }
