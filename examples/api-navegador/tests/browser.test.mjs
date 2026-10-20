import test from 'node:test'
import assert from 'node:assert/strict'
import { chromium } from '@playwright/test'
import { startLab } from '../lab.mjs'

async function setup(t) {
  const lab = await startLab()
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext()
  const page = await context.newPage()
  // Observar sin interceptar: routing de Playwright altera el preflight nativo.
  const allowed = new Set([lab.app, lab.attacker, lab.trusted, lab.crossSite])
  const unexpected = []
  context.on('request', (request) => {
    if (!allowed.has(new URL(request.url()).origin)) unexpected.push(request.url())
  })
  t.after(async () => {
    await browser.close()
    await lab.close()
    assert.deepEqual(unexpected, [])
  })
  await page.goto(`${lab.app}/session`)
  return { ...lab, context, page }
}

const payload = '<img src="/missing" onerror="document.body.dataset.executed=\'yes\'">'

test('Chromium: innerHTML ejecuta el marcador; textContent conserva literalmente la entrada', async (t) => {
  const { page, app } = await setup(t)
  await page.goto(`${app}/xss?mode=unsafe&q=${encodeURIComponent(payload)}`)
  await page.waitForFunction(() => document.body.dataset.executed === 'yes')
  await page.goto(`${app}/xss?mode=safe&q=${encodeURIComponent(payload)}`)
  assert.equal(await page.locator('#output').textContent(), payload)
  assert.equal(await page.locator('#output img').count(), 0)
  assert.equal(await page.locator('body').getAttribute('data-executed'), null)
})

test('Chromium: enforce bloquea el handler pero conserva el HTML; Report-Only permite ejecutarlo', async (t) => {
  const { page, app } = await setup(t)
  const violations = []
  await page.exposeFunction('recordViolation', (value) => violations.push(value))
  await page.addInitScript(() =>
    document.addEventListener('securitypolicyviolation', (event) =>
      window.recordViolation({
        directive: event.effectiveDirective,
        disposition: event.disposition,
      }),
    ),
  )
  await page.goto(`${app}/xss?mode=enforce&q=${encodeURIComponent(payload)}`)
  await page.waitForFunction(() => document.body.dataset.ready === 'yes')
  assert.equal(await page.locator('#output img').count(), 1)
  assert.equal(await page.locator('body').getAttribute('data-executed'), null)
  assert.ok(
    violations.some(
      (v) => v.disposition === 'enforce' && v.directive === 'script-src-attr',
    ),
  )
  await page.goto(`${app}/xss?mode=report&q=${encodeURIComponent(payload)}`)
  await page.waitForFunction(() => document.body.dataset.executed === 'yes')
  assert.ok(violations.some((v) => v.disposition === 'report'))
})

test('Chromium: HttpOnly oculta la cookie pero XSS lee storage y hace una petición con sesión', async (t) => {
  const { page, app } = await setup(t)
  await page.evaluate(() => localStorage.setItem('demo', 'dato ficticio'))
  const marker =
    "<img src=\"/missing\" onerror=\"document.body.dataset.storage=localStorage.getItem('demo');fetch('/api/title/unsafe',{method:'POST',body:new URLSearchParams({title:'Desde XSS'})}).then(()=>document.body.dataset.changed='yes')\">"
  await page.goto(`${app}/xss?mode=unsafe&q=${encodeURIComponent(marker)}`)
  await page.waitForFunction(() => document.body.dataset.changed === 'yes')
  assert.equal(await page.evaluate(() => document.cookie), '')
  assert.equal(await page.locator('body').getAttribute('data-storage'), 'dato ficticio')
  assert.equal(
    await page.evaluate(async () => (await (await fetch('/api/state')).json()).title),
    'Desde XSS',
  )
})

test('Chromium: formulario cross-origin same-site usa Lax; la ruta segura deniega sin efectos', async (t) => {
  const { page, app, attacker } = await setup(t)
  await page.goto(`${attacker}/form?target=unsafe`)
  await Promise.all([
    page.waitForURL(`${app}/api/title/unsafe`),
    page.getByRole('button').click(),
  ])
  assert.equal(
    JSON.parse(await page.locator('body').textContent()).title,
    'Desde otro origen',
  )
  await page.goto(`${attacker}/form?target=safe`)
  const responsePromise = page.waitForResponse(`${app}/api/title/safe`)
  await page.getByRole('button').click()
  assert.equal((await responsePromise).status(), 403)
  await page.goto(`${app}/session-view`)
  assert.equal(
    await page.evaluate(async () => (await (await fetch('/api/state')).json()).title),
    'Desde otro origen',
  )
})

test('Chromium: un formulario cross-site POST no lleva la cookie Lax explícita', async (t) => {
  const { page, app, crossSite } = await setup(t)
  await page.goto(`${crossSite}/form?target=unsafe`)
  const responsePromise = page.waitForResponse(`${app}/api/title/unsafe`)
  await page.getByRole('button').click()
  assert.equal((await responsePromise).status(), 401)
  await page.goto(`${app}/session-view`)
  assert.equal(
    await page.evaluate(async () => (await (await fetch('/api/state')).json()).title),
    'Original',
  )
})

test('Chromium: mutación legítima con token y Origin funciona; token no es la cookie', async (t) => {
  const { page } = await setup(t)
  const result = await page.evaluate(async () => {
    const { csrf } = await (await fetch('/api/token')).json()
    const response = await fetch('/api/title/safe', {
      method: 'POST',
      body: new URLSearchParams({ title: 'Legítimo', csrf }),
    })
    return { status: response.status, body: await response.json() }
  })
  assert.equal(result.status, 200)
  assert.equal(result.body.title, 'Legítimo')
})

test('Chromium: CORS controla lectura, incluye origen permitido y rechaza wildcard con cookies', async (t) => {
  const { page, app, attacker, trusted } = await setup(t)
  async function read(origin, mode) {
    await page.goto(origin)
    return page.evaluate(
      async ({ app, mode }) => {
        try {
          return {
            ok: true,
            body: await (
              await fetch(`${app}/api/cors/${mode}`, { credentials: 'include' })
            ).json(),
          }
        } catch {
          return { ok: false }
        }
      },
      { app, mode },
    )
  }
  assert.equal((await read(attacker, 'closed')).ok, false)
  assert.equal((await read(attacker, 'allow')).ok, false)
  assert.equal((await read(trusted, 'allow')).body.title, 'Original')
  assert.equal((await read(trusted, 'wildcard')).ok, false)
})

test('Chromium: POST simple llega sin lectura CORS; PATCH necesita preflight antes de enviarse', async (t) => {
  const { page, app, attacker, trusted, metrics } = await setup(t)
  await page.goto(attacker)
  const simple = await page.evaluate(async (app) => {
    try {
      await fetch(`${app}/api/title/unsafe`, {
        method: 'POST',
        credentials: 'include',
        body: new URLSearchParams({ title: 'Sin lectura CORS' }),
      })
      return 'read'
    } catch {
      return 'blocked'
    }
  }, app)
  assert.equal(simple, 'blocked')
  await page.goto(`${app}/session-view`)
  assert.equal(
    await page.evaluate(async () => (await (await fetch('/api/state')).json()).title),
    'Sin lectura CORS',
  )
  async function patch(origin, mode) {
    await page.goto(origin)
    return page.evaluate(
      async ({ app, mode }) => {
        try {
          const response = await fetch(`${app}/api/preflight/${mode}`, {
            method: 'PATCH',
            credentials: 'include',
            headers: { 'X-Lab': 'yes', 'Content-Type': 'application/json' },
            body: '{}',
          })
          return response.status
        } catch {
          return 'blocked'
        }
      },
      { app, mode },
    )
  }
  assert.equal(await patch(attacker, 'allow'), 'blocked')
  assert.equal(metrics.patch, 0)
  assert.equal(await patch(trusted, 'allow'), 200)
  assert.equal(metrics.patch, 1)
  assert.equal(metrics.options, 2)
})
