import assert from 'node:assert/strict'
import { readFile, writeFile, mkdtemp } from 'node:fs/promises'
import { chromium } from '@playwright/test'
const origin = process.env.KUBERNETES_DRAFT_ORIGIN ?? 'http://127.0.0.1:4322'
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(origin).hostname))
const manifest = JSON.parse(await readFile('docs/editorial/kubernetes-series.json'))
const data = JSON.parse(await readFile('public/assets/interactive/kubernetes-workloads/replay.json'))
const folder = await mkdtemp('/tmp/kubernetes-layout.'), report = [], errors = []
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
      for (const image of await page.locator('article img[src*="/kubernetes/"],article img[src*="/kubernetes-workloads/"]').all()) {
        await image.scrollIntoViewIfNeeded(); await page.waitForFunction((e) => e.complete && e.naturalWidth > 0, await image.elementHandle())
        if (width === 360) await page.screenshot({ path: folder + '/' + entry.id + '-image-' + (await image.getAttribute('src')).split('/').at(-1) + '.png' })
      }
      for (const link of await page.locator('article a[href^="/posts/"],article a[href^="/assets/"]').all()) assert.equal((await page.request.get(origin + await link.getAttribute('href'))).status(), 200)
      for (const pre of await page.locator('article pre[tabindex="0"]').all()) { await pre.scrollIntoViewIfNeeded(); await pre.focus(); assert.ok(await pre.evaluate((e) => document.activeElement === e)) }
      if (entry.id === 'K8S-HPA') { await page.locator('iframe').scrollIntoViewIfNeeded(); await page.frameLocator('iframe').locator('#event:not([disabled])').waitFor({ state: 'visible' }) }
      await page.locator('h1#' + entry.slug).scrollIntoViewIfNeeded(); await page.screenshot({ path: folder + '/' + entry.id + '-' + width + '.png', fullPage: true })
      report.push({ id: entry.id, width, status: 'passed' })
    }
    const base = origin + '/assets/interactive/kubernetes-workloads/', requests = [], listener = (r) => requests.push(r.url()); page.on('request', listener)
    assert.equal((await page.goto(base + 'explorer.html', { waitUntil: 'networkidle' })).status(), 200); await page.locator('#event:not([disabled])').waitFor()
    const show = (v) => v === undefined || v === null ? 'No capturado' : String(v)
    for (const [i, event] of data.events.entries()) {
      await page.selectOption('#event', String(i)); const f = event.facts, pod = f.pod ?? f.after
      const expected = [f.http?.status, f.http?.body.message, f.http?.body.version, pod?.ready, pod?.restarts, f.endpoints?.filter((e) => e.ready === true).length, f.sample?.desired, f.sample?.ready].map(show)
      assert.deepEqual(await page.locator('#snapshot td:nth-child(2)').allTextContents(), expected)
      assert.deepEqual(JSON.parse(await page.locator('#facts').textContent()), f)
      assert.ok((await page.locator('#summary').textContent()).startsWith('#' + event.seq + ' · ' + event.id))
      assert.equal(await page.locator('#previous').isDisabled(), i === 0); assert.equal(await page.locator('#next').isDisabled(), i === data.events.length - 1)
    }
    const first = data.samples[0].elapsedMs, span = data.samples.at(-1).elapsedMs - first
    for (const [i, sample] of data.samples.entries()) {
      await page.locator('#sample').focus(); await page.locator('#sample').press(i === 0 ? 'Home' : 'ArrowRight')
      assert.deepEqual(await page.locator('#sample-values td:nth-child(2)').allTextContents(), [sample.phase, sample.cpuPercent, sample.target, sample.desired, sample.current, sample.ready].map(show))
      const prefix = data.samples.slice(0, i + 1)
      for (const key of ['desired', 'ready']) {
        const points = prefix.filter((s) => Number.isFinite(s[key]) && (key !== 'desired' || Number.isFinite(s.cpuPercent))).map((s) => [(40 + 310 * (s.elapsedMs - first) / span).toFixed(2), (245 - 60 * s[key]).toFixed(2)].join(',')).join(' ')
        assert.equal(await page.locator('[data-series="' + key + '"]').getAttribute('points'), points)
        if (Number.isFinite(sample[key]) && (key !== 'desired' || Number.isFinite(sample.cpuPercent))) {
          const dot = await page.locator('[data-current="' + key + '"]').evaluate((e) => [Number(e.getAttribute('cx')), Number(e.getAttribute('cy'))])
          assert.ok(Math.abs(dot[0] - (40 + 310 * (sample.elapsedMs - first) / span)) < 0.001); assert.equal(dot[1], 245 - 60 * sample[key])
        } else assert.equal(await page.locator('[data-current="' + key + '"]').count(), 0)
      }
      assert.equal(await page.locator('#sample-previous').isDisabled(), i === 0); assert.equal(await page.locator('#sample-next').isDisabled(), i === data.samples.length - 1)
    }
    await page.locator('#event').focus(); await page.locator('#event').press('Home'); await page.locator('#event').press('Enter'); assert.equal(await page.locator('#event').inputValue(), '0')
    await page.locator('#next').focus(); await page.locator('#next').press('Enter'); assert.equal(await page.locator('#event').inputValue(), '1')
    await page.locator('#previous').focus(); await page.locator('#previous').press('Enter'); assert.equal(await page.locator('#event').inputValue(), '0')
    await page.locator('#sample').focus(); await page.locator('#sample').press('Home'); assert.equal(await page.locator('#sample').inputValue(), '0')
    await page.locator('#sample-next').focus(); await page.locator('#sample-next').press('Enter'); assert.equal(await page.locator('#sample').inputValue(), '1')
    await page.locator('#sample-previous').focus(); await page.locator('#sample-previous').press('Enter'); assert.equal(await page.locator('#sample').inputValue(), '0')
    await page.selectOption('#event', '19'); await page.locator('#sample').focus(); await page.locator('#sample').press('End')
    await page.locator('summary').focus(); await page.locator('summary').press('Enter'); assert.equal(await page.locator('details').evaluate((e) => e.open), true)
    for (const region of await page.locator('[role="region"],#facts').all()) { await region.scrollIntoViewIfNeeded(); await region.focus(); assert.ok(await region.evaluate((e) => document.activeElement === e)); if (await region.evaluate((e) => e.scrollWidth > e.clientWidth + 2)) { await region.press('ArrowRight'); await page.waitForFunction((e) => e.scrollLeft > 0, await region.elementHandle()) } }
    await page.waitForTimeout(250)
    for (const region of await page.locator('[role="region"],#facts').all()) await region.evaluate((e) => e.scrollTo({ left: 0, behavior: 'instant' }))
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
    assert.match(await page.locator('meta[name="robots"]').getAttribute('content'), /noindex/)
    page.off('request', listener); assert.ok(requests.every((url) => url.startsWith(base)), requests.join('\n'))
    await page.locator('h1').scrollIntoViewIfNeeded(); await page.screenshot({ path: folder + '/viewer-' + width + '.png', fullPage: true })
    report.push({ id: 'viewer', width, phases: data.events.length, samples: data.samples.length, status: 'passed' })
  }
  await page.route('**/kubernetes-workloads/replay.json', (route) => route.abort()); await page.goto(origin + '/assets/interactive/kubernetes-workloads/explorer.html', { waitUntil: 'networkidle' })
  assert.match(await page.locator('#error').textContent(), /No se pudo cargar la captura/); assert.equal(await page.locator('#event').isDisabled(), true); assert.equal(await page.locator('#sample').isDisabled(), true)
  assert.deepEqual(errors, []); await writeFile(folder + '/report.json', JSON.stringify({ report, missingReport: 'explicit_error', errors }, null, 2))
  console.log(JSON.stringify({ folder, views: report.length, errors }))
} finally { await browser.close() }
