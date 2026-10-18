import { createRequire } from 'node:module'
import { readFile, mkdtemp, writeFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
const require = createRequire(
  new URL('../examples/frontend-tiempo-real/package.json', import.meta.url),
)
const { chromium } = require('@playwright/test')
const origin = process.env.API_DRAFT_ORIGIN ?? 'http://127.0.0.1:4322'
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(origin).hostname))
const manifest = JSON.parse(
  await readFile('docs/editorial/api-contracts-series.json', 'utf8'),
)
const folder = await mkdtemp('/tmp/api-contracts-layout.')
const browser = await chromium.launch({ headless: true })
const report = []
try {
  const page = await browser.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(String(error)))
  for (const width of [1440, 360])
    for (const entry of manifest.articles) {
      await page.setViewportSize({ width, height: 1000 })
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
        ),
        `${entry.id} a ${width}px: overflow horizontal de la página`,
      )
      for (const image of await page
        .locator('img[src*="/assets/visuals/api-contracts/"]')
        .all()) {
        await image.scrollIntoViewIfNeeded()
        // Con loading=lazy, scrollIntoView puede resolver antes de iniciar la carga.
        await page.waitForFunction(
          (element) => element.complete && element.naturalWidth > 0,
          await image.elementHandle(),
          { timeout: 10000 },
        )
        await image.evaluate((element) => element.decode())
        if (width === 360 && !['P020', 'P021'].includes(entry.id)) {
          await page.screenshot({
            path: `${folder}/${entry.id}-${(await image.getAttribute('src')).split('/').at(-1)}-mobile.png`,
          })
        }
      }
      if (entry.id === 'P023' && width === 360) {
        const table = page.getByRole('region', {
          name: 'Errores HTTP y decisiones del cliente',
        })
        await table.scrollIntoViewIfNeeded()
        await table.focus()
        await table.press('ArrowRight')
        await page.waitForFunction(
          (element) => element.scrollLeft > 0,
          await table.elementHandle(),
        )
        await page.screenshot({ path: `${folder}/P023-table-mobile.png` })
      }
      for (const link of await page
        .locator('article a[href^="/posts/"],a[href^="/assets/examples/"]')
        .all()) {
        const href = await link.getAttribute('href')
        assert.equal((await page.request.get(origin + href)).status(), 200, href)
      }
      assert.equal(await page.locator('.katex-error').count(), 0)
      await page.locator(`h1#${entry.slug}`).scrollIntoViewIfNeeded()
      await page.screenshot({
        path: `${folder}/${entry.id}-${width}.png`,
        fullPage: true,
      })
      report.push({ id: entry.id, width })
    }
  await page.setViewportSize({ width: 360, height: 1000 })
  await page.goto(`${origin}/assets/interactive/api-pagination/explorer.html`, {
    waitUntil: 'networkidle',
  })
  assert.equal(await page.locator('#first li').count(), 5)
  await page.locator('#change').selectOption('insert')
  assert.equal(await page.locator('#offset .duplicate').count(), 1)
  assert.equal(await page.locator('#keyset .duplicate').count(), 0)
  await page.locator('#change').selectOption('move')
  assert.equal(await page.locator('#keyset .duplicate').count(), 1)
  assert.equal(await page.locator('#snapshot .duplicate').count(), 0)
  await page.locator('#change').selectOption('delete')
  assert.equal(await page.locator('#offset li').count(), 4)
  assert.equal(await page.locator('#keyset li').count(), 5)
  await page.locator('#reset').click()
  assert.equal(await page.locator('#change').inputValue(), 'none')
  await page.locator('#change').focus()
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')
  assert.equal(await page.locator('#change').inputValue(), 'insert')
  // Cerrar el popup nativo del select antes de capturar la página en Chromium.
  await page.keyboard.press('Escape')
  await page.locator('#reset').focus()
  assert.ok(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
    ),
  )
  await page.screenshot({
    path: `${folder}/pagination-explorer-mobile.png`,
    fullPage: true,
  })
  report.push({
    id: 'pagination-explorer',
    width: 360,
    cases: ['insert', 'move', 'delete', 'reset', 'keyboard'],
  })
  assert.deepEqual(errors, [])
  await writeFile(`${folder}/report.json`, JSON.stringify(report, null, 2) + '\n')
  console.log(folder)
} finally {
  await browser.close()
}
