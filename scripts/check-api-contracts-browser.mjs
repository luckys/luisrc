import { readFile, mkdtemp, writeFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
const { chromium } = await import('@playwright/test')
const origin = process.env.API_DRAFT_ORIGIN ?? 'http://127.0.0.1:4322'
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(origin).hostname))
const manifest = JSON.parse(
  await readFile('docs/editorial/api-contracts-series.json', 'utf8'),
)
const requestedIds = process.env.API_DRAFT_IDS?.split(',')
const entries = requestedIds
  ? manifest.articles.filter((entry) => requestedIds.includes(entry.id))
  : manifest.articles
if (requestedIds)
  assert.deepEqual(
    entries.map((entry) => entry.id).toSorted(),
    requestedIds.toSorted(),
    'IDs de revisión desconocidos o repetidos',
  )
const folder = await mkdtemp('/tmp/api-contracts-layout.')
const browser = await chromium.launch({ headless: true })
const report = []
try {
  const page = await browser.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(String(error)))
  for (const width of [1440, 360])
    for (const entry of entries) {
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
      if (['P028', 'API-AUTHZ-TESTS'].includes(entry.id) && width === 360) {
        const table = page.getByRole('region', {
          name:
            entry.id === 'P028'
              ? 'Política de lectura y edición por rol'
              : 'Casos adversariales de autorización HTTP',
        })
        await table.scrollIntoViewIfNeeded()
        await table.focus()
        assert.ok(await table.evaluate((element) => element === document.activeElement))
        await table.press('ArrowRight')
        await page.screenshot({ path: `${folder}/${entry.id}-table-mobile.png` })
      }
      if (entry.id === 'API-THREATS-SECRETS' && width === 360) {
        const table = page.getByRole('region', {
          name: 'Etapas de rotación y respuestas HTTP',
        })
        await table.scrollIntoViewIfNeeded()
        await table.focus()
        await table.press('ArrowRight')
        await page.waitForFunction(
          (element) => element.scrollLeft > 0,
          await table.elementHandle(),
        )
        await page.screenshot({ path: `${folder}/${entry.id}-table-mobile.png` })
      }
      for (const link of await page
        .locator('article a[href^="/posts/"],article a[href^="/assets/interactive/"]')
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
  await page.goto(`${origin}/assets/interactive/api-authorization/explorer.html`, {
    waitUntil: 'networkidle',
  })
  const result = page.locator('#result')
  assert.equal(await result.textContent(), 'Permitido')
  await page.locator('#state').selectOption('published')
  assert.equal(await result.textContent(), 'Denegado')
  await page.locator('#role').selectOption('admin')
  assert.equal(await result.textContent(), 'Denegado')
  await page.locator('#state').selectOption('draft')
  await page.locator('#owner').selectOption('bob')
  assert.equal(await result.textContent(), 'Permitido')
  await page.locator('#tenant').selectOption('south')
  assert.equal(await result.textContent(), 'Denegado')
  await page.locator('#reset').click()
  assert.equal(await result.textContent(), 'Permitido')
  await page.locator('#role').selectOption('unknown')
  assert.equal(await result.textContent(), 'Denegado')
  await page.locator('#reset').click()
  await page.locator('#role').focus()
  await page.keyboard.press('ArrowUp')
  await page.keyboard.press('Enter')
  await page.keyboard.press('Escape')
  assert.equal(await page.locator('#role').inputValue(), 'reader')
  assert.equal(await result.textContent(), 'Denegado')
  assert.ok(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
    ),
  )
  await page.screenshot({
    path: `${folder}/authorization-explorer-mobile.png`,
    fullPage: true,
  })
  report.push({
    id: 'authorization-explorer',
    width: 360,
    cases: [
      'own-draft',
      'published',
      'admin-limited',
      'tenant',
      'unknown-role',
      'reset',
      'keyboard',
    ],
  })
  await page.goto(`${origin}/assets/interactive/api-assignment/explorer.html`, {
    waitUntil: 'networkidle',
  })
  for (const mode of ['safe', 'unsafe'])
    assert.equal(
      await page.locator(`#${mode}-status`).textContent(),
      'Resultado simulado: 200',
    )
  await page.locator('#example').selectOption('protected')
  assert.equal(
    await page.locator('#unsafe-meter').evaluate((element) => element.value),
    3,
  )
  assert.equal(await page.locator('#safe-meter').evaluate((element) => element.value), 0)
  assert.equal(
    await page.locator('#safe-status').textContent(),
    'Resultado simulado: 422',
  )
  assert.equal(
    JSON.parse(await page.locator('#safe-after').textContent()).title,
    'Original',
  )
  await page.screenshot({
    path: `${folder}/assignment-explorer-protected-mobile.png`,
    fullPage: true,
  })
  for (const value of ['unknown', 'nested']) {
    await page.locator('#example').selectOption(value)
    assert.equal(
      await page.locator('#safe-status').textContent(),
      'Resultado simulado: 422',
    )
  }
  await page.locator('#example').selectOption('malformed')
  assert.equal(
    await page.locator('#unsafe-status').textContent(),
    'Resultado simulado: 400',
  )
  assert.equal(
    await page.locator('#safe-status').textContent(),
    'Resultado simulado: 400',
  )
  await page
    .locator('#payload')
    .fill(JSON.stringify({ title: '<img src=x onerror="window.__executed=true">' }))
  await page.locator('#apply').click()
  assert.equal(
    await page.locator('#safe-status').textContent(),
    'Resultado simulado: 200',
  )
  assert.equal(await page.locator('#results img').count(), 0)
  assert.equal(await page.evaluate(() => window.__executed), undefined)
  assert.ok((await page.locator('#safe-after').textContent()).includes('<img'))
  await page.locator('#reset').focus()
  await page.keyboard.press('Enter')
  assert.equal(await page.locator('#example').inputValue(), 'normal')
  assert.equal(
    await page.locator('#unsafe-meter').evaluate((element) => element.value),
    0,
  )
  assert.ok(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
    ),
  )
  await page.screenshot({
    path: `${folder}/assignment-explorer-mobile.png`,
    fullPage: true,
  })
  report.push({
    id: 'assignment-explorer',
    width: 360,
    cases: [
      'normal',
      'protected',
      'unknown',
      'nested',
      'malformed',
      'literal-html',
      'reset-keyboard',
    ],
  })
  const ssrfEvidence = JSON.parse(
    await readFile('public/assets/interactive/api-ssrf/ssrf-evidence.json', 'utf8'),
  )
  await page.goto(`${origin}/assets/interactive/api-ssrf/ssrf-explorer.html`, {
    waitUntil: 'networkidle',
  })
  await page.waitForFunction(() => !document.querySelector('#scenario').disabled)
  for (const row of ssrfEvidence.observations) {
    await page.locator('#scenario').selectOption(row.scenario)
    assert.equal(await page.locator('#events li').count(), 0)
    for (let index = 0; index < row.events.length; index++) {
      await page.locator('#next').click()
      assert.equal(await page.locator('#events li').count(), index + 1)
    }
    assert.equal(
      await page.locator('#provider').evaluate((element) => element.value),
      row.providerRequests,
    )
    assert.equal(
      await page.locator('#internal').evaluate((element) => element.value),
      row.internalRequests,
    )
    for (const destination of ['provider', 'internal']) {
      const count = row[`${destination}Requests`]
      assert.equal(
        await page.locator(`#${destination}-count`).textContent(),
        count === 1 ? '1 petición recibida' : `${count} peticiones recibidas`,
      )
    }
    assert.ok(
      (await page.locator('#result').textContent()).includes(`HTTP ${row.status}`),
    )
    if (row.text)
      assert.ok((await page.locator('#result').textContent()).includes(row.text))
    assert.equal(await page.locator('#next').isDisabled(), true)
    if (['dns-gap', 'pinned'].includes(row.scenario))
      await page.screenshot({
        path: `${folder}/ssrf-${row.scenario}-mobile.png`,
        fullPage: true,
      })
  }
  await page.locator('#reset').focus()
  await page.keyboard.press('Enter')
  assert.equal(await page.locator('#step').inputValue(), '0')
  await page.locator('#step').focus()
  await page.keyboard.press('ArrowRight')
  assert.equal(await page.locator('#events li').count(), 1)
  assert.ok(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
    ),
  )
  // Solo se intercepta el JSON estático de este visor, no preflight o tráfico de los laboratorios.
  await page.route('**/api-ssrf/ssrf-evidence.json', (route) =>
    route.fulfill({ status: 404, body: '{}' }),
  )
  await page.reload({ waitUntil: 'networkidle' })
  assert.equal(await page.locator('#scenario').isDisabled(), true)
  assert.ok(
    (await page.locator('#load-status').textContent()).includes('No se pudo cargar'),
  )
  await page.unroute('**/api-ssrf/ssrf-evidence.json')
  report.push({
    id: 'ssrf-explorer',
    width: 360,
    cases: [
      ...ssrfEvidence.observations.map((row) => row.scenario),
      'reset-keyboard',
      'range-keyboard',
      'missing-evidence',
    ],
  })
  await page.goto(`${origin}/assets/interactive/api-quota/quota-explorer.html`, {
    waitUntil: 'networkidle',
  })
  assert.equal(await page.locator('#events li').count(), 0)
  for (let index = 0; index < 8; index++) await page.locator('#next').click()
  assert.equal(await page.locator('#events li[data-allowed="false"]').count(), 2)
  assert.equal(await page.locator('#points circle').count(), 8)
  assert.ok((await page.locator('#events li').nth(5).textContent()).includes('Saldo 0,5'))
  assert.equal(await page.locator('#next').isDisabled(), true)
  assert.ok(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
    ),
  )
  await page.screenshot({ path: `${folder}/quota-burst-mobile.png`, fullPage: true })
  await page.locator('#scenario').selectOption('tenants')
  for (let index = 0; index < 8; index++) await page.locator('#next').click()
  assert.equal(await page.locator('#events li[data-allowed="false"]').count(), 1)
  await page.locator('#scenario').selectOption('sustained')
  for (let index = 0; index < 8; index++) await page.locator('#next').click()
  assert.equal(await page.locator('#events li[data-allowed="false"]').count(), 0)
  await page.locator('#capacity').selectOption('1')
  await page.locator('#scenario').selectOption('burst')
  for (let index = 0; index < 8; index++) await page.locator('#next').click()
  assert.equal(await page.locator('#events li[data-allowed="true"]').count(), 3)
  await page.locator('#rate').selectOption('2')
  for (let index = 0; index < 8; index++) await page.locator('#next').click()
  assert.equal(await page.locator('#events li[data-allowed="true"]').count(), 4)
  await page.locator('#reset').focus()
  await page.keyboard.press('Enter')
  assert.equal(await page.locator('#capacity').inputValue(), '4')
  assert.equal(await page.locator('#rate').inputValue(), '1')
  assert.equal(await page.locator('#events li').count(), 0)
  await page.locator('#step').focus()
  await page.keyboard.press('ArrowRight')
  assert.equal(await page.locator('#events li').count(), 1)
  report.push({
    id: 'quota-explorer',
    width: 360,
    cases: [
      'burst',
      'fractional-refill',
      'tenants',
      'sustained',
      'capacity',
      'rate',
      'reset-keyboard',
      'range-keyboard',
    ],
  })
  assert.deepEqual(errors, [])
  await writeFile(`${folder}/report.json`, JSON.stringify(report, null, 2) + '\n')
  console.log(folder)
} finally {
  await browser.close()
}
