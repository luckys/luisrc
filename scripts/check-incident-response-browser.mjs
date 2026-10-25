import assert from 'node:assert/strict'
import { readFile, mkdtemp, writeFile } from 'node:fs/promises'
import { chromium } from '@playwright/test'

const origin = process.env.INCIDENT_DRAFT_ORIGIN ?? 'http://127.0.0.1:4322'
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(origin).hostname))
const manifest = JSON.parse(await readFile('docs/editorial/incident-response-series.json'))
const data = JSON.parse(await readFile('public/assets/interactive/incident-response/replay.json'))
const folder = await mkdtemp('/tmp/incident-response-layout.')
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
      const image = page.locator('img[src*="/assets/visuals/incident-response/"]')
      assert.equal(await image.count(), 1)
      await image.scrollIntoViewIfNeeded()
      await page.waitForFunction((e) => e.complete && e.naturalWidth > 0, await image.elementHandle())
      await image.evaluate((e) => e.decode())
      if (width === 360) await page.screenshot({ path: `${folder}/${entry.id}-diagram.png` })
      for (const link of await page.locator('article a[href^="/posts/"],article a[href^="/assets/"]').all()) assert.equal((await page.request.get(origin + await link.getAttribute('href'))).status(), 200)
      for (const pre of await page.locator('article pre[tabindex="0"]').all()) {
        await pre.scrollIntoViewIfNeeded(); await pre.focus()
        assert.ok(await pre.evaluate((e) => document.activeElement === e))
      }
      for (const region of await page.locator('article [role="region"]:has(table)').all()) {
        await region.scrollIntoViewIfNeeded(); await region.focus()
        assert.ok(await region.evaluate((e) => document.activeElement === e))
        if (width === 360 && await region.evaluate((e) => e.scrollWidth > e.clientWidth)) {
          await region.press('ArrowRight'); await page.waitForFunction((e) => e.scrollLeft > 0, await region.elementHandle())
          await page.screenshot({ path: `${folder}/${entry.id}-table.png` })
        }
      }
      if (entry.id === 'INC-MITIGATION') {
        const chart = page.locator('article img[src*="/interactive/incident-response/"]')
        await chart.scrollIntoViewIfNeeded()
        await page.waitForFunction((e) => e.complete && e.naturalWidth > 0, await chart.elementHandle())
        await chart.evaluate((e) => e.decode())
        if (width === 360) await page.screenshot({ path: `${folder}/chart-360.png` })
      }
      if (entry.id === 'INC-POSTMORTEM') {
        await page.locator('iframe[src*="incident-response/"]').scrollIntoViewIfNeeded()
        await page.frameLocator('iframe[src*="incident-response/"]').locator('#event:not([disabled])').waitFor({ state: 'visible' })
      }
      await page.locator(`h1#${entry.slug}`).scrollIntoViewIfNeeded()
      await page.screenshot({ path: `${folder}/${entry.id}-${width}.png`, fullPage: true })
      report.push({ id: entry.id, width, status: 'passed' })
    }
    const requests = [], listener = (r) => requests.push(r.url())
    page.on('request', listener)
    await page.goto(origin + '/assets/interactive/incident-response/explorer.html', { waitUntil: 'networkidle' })
    await page.locator('#event:not([disabled])').waitFor({ state: 'visible' })
    assert.match(await page.locator('meta[name="robots"]').getAttribute('content'), /noindex/)
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
    for (const e of data.events) {
      await page.selectOption('#event', e.id)
      const state = e.facts.state ?? (e.facts.jobs ? e.facts : {})
      const worker = state.worker ?? e.facts.worker
      const expected = [state.accepted, state.completed, state.queued,
        worker ? `${worker.config.batchSize} / ${worker.config.revision}` : undefined,
        worker ? `${worker.ticks} / ${worker.attempts}` : undefined, state.admissionOpen]
        .map((value) => value === undefined ? 'No capturado' : String(value))
      assert.deepEqual(await page.locator('#snapshot td').allTextContents(), expected)
      assert.match(await page.locator('#summary').textContent(), new RegExp(`^#${e.seq} · ${e.id} · ${e.phase}`))
      assert.ok((await page.locator('#summary').textContent()).includes(e.at))
      assert.deepEqual(JSON.parse(await page.locator('#facts').textContent()), e.facts)
    }
    let phases = 0
    for (const phase of new Set(data.events.map((e) => e.phase))) {
      await page.selectOption('#phase', phase)
      const selected = data.events.filter((e) => e.phase === phase)
      assert.deepEqual(await page.locator('#event option').evaluateAll((options) => options.map((o) => o.value)), selected.map((e) => e.id))
      assert.equal(await page.locator('#event').inputValue(), selected[0].id)
      assert.equal(await page.locator('#previous').isDisabled(), true)
      for (let i = 1; i < selected.length; i++) {
        await page.locator('#next').focus(); await page.locator('#next').press('Enter')
        assert.equal(await page.locator('#event').inputValue(), selected[i].id)
      }
      assert.equal(await page.locator('#next').isDisabled(), true)
      phases++
    }
    await page.selectOption('#phase', 'all')
    await page.locator('#event').focus(); await page.locator('#event').press('End'); await page.locator('#event').press('Enter')
    assert.equal(await page.locator('#event').inputValue(), data.events.at(-1).id)
    await page.locator('#previous').focus(); await page.locator('#previous').press('Enter')
    assert.equal(await page.locator('#event').inputValue(), data.events.at(-2).id)
    assert.equal(await page.locator('#actions tr').count(), 4)
    assert.equal(await page.locator('#actions button').count(), 2)
    for (const action of data.actions.filter((a) => a.proof)) {
      await page.selectOption('#phase', 'triage')
      const button = page.getByRole('button', { name: action.proof, exact: true })
      await button.focus(); await button.press('Enter')
      assert.equal(await page.locator('#phase').inputValue(), 'all')
      assert.equal(await page.locator('#event').inputValue(), action.proof)
    }
    await page.locator('details summary').click()
    await page.locator('#facts').focus()
    assert.ok(await page.locator('#facts').evaluate((e) => document.activeElement === e))
    for (const [i, region] of (await page.locator('[role="region"]').all()).entries()) {
      await region.scrollIntoViewIfNeeded(); await region.focus()
      assert.ok(await region.evaluate((e) => document.activeElement === e))
      if (width === 360) {
        if (await region.evaluate((e) => e.scrollWidth > e.clientWidth)) {
          await region.press('ArrowRight')
          await page.waitForFunction((e) => e.scrollLeft > 0, await region.elementHandle())
        }
        await page.screenshot({ path: `${folder}/viewer-region-${i}-360.png` })
      }
    }
    assert.ok(requests.every((url) => url.startsWith(origin + '/assets/interactive/incident-response/')))
    page.off('request', listener)
    await page.screenshot({ path: `${folder}/viewer-${width}.png`, fullPage: true })
    report.push({ id: 'viewer', width, events: data.events.length, phases, proofs: 2, status: 'passed' })
  }
  assert.deepEqual(errors, [])
  await writeFile(`${folder}/report.json`, JSON.stringify(report, null, 2))
  console.log(`${report.length} vistas verificadas: ${folder}/report.json`)
} finally { await browser.close() }
