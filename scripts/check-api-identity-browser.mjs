import { createRequire } from 'node:module'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { startLab } from '../examples/api-identidad/lab.mjs'

const require = createRequire(
  new URL('../examples/frontend-tiempo-real/package.json', import.meta.url),
)
const { chromium } = require('@playwright/test')
const folder = await mkdtemp('/tmp/api-identity-browser.')
const lab = await startLab()
let browser
try {
  browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: 360, height: 800 },
  })
  await context.route('**/*', (route) =>
    new URL(route.request().url()).hostname === '127.0.0.1'
      ? route.continue()
      : route.abort(),
  )
  // Excepción solo para este contexto y el RP autofirmado local, no para Node/OS.
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(String(error)))
  await page.goto(lab.origin)
  await page.getByRole('link', { name: 'Iniciar sesión de prueba' }).click()
  await page.locator('input[name="login"]').fill('alice')
  await page.locator('input[name="password"]').fill('not-a-real-password')
  await page.locator('button[type="submit"]').click()
  await page
    .locator('input[name="prompt"][value="consent"]')
    .waitFor({ state: 'attached' })
  await page.locator('button[type="submit"]').click()
  await page.waitForURL(`${lab.origin}/`)
  const session = (await context.cookies(lab.origin)).find(
    (cookie) => cookie.name === '__Host-sid',
  )
  assert.ok(session)
  assert.equal(session.httpOnly, true)
  assert.equal(session.secure, true)
  assert.equal(session.sameSite, 'Lax')
  assert.equal(session.path, '/')
  assert.ok(!(await page.evaluate(() => document.cookie)).includes('__Host-sid'))
  assert.equal((await context.request.get(`${lab.origin}/me`)).status(), 200)
  const copied = await browser.newContext({ ignoreHTTPSErrors: true })
  await copied.addCookies([session])
  const logout = await page.evaluate(() =>
    fetch('/logout', { method: 'POST' }).then((response) => response.status),
  )
  assert.equal(logout, 204)
  assert.equal((await copied.request.get(`${lab.origin}/me`)).status(), 401)
  assert.ok(
    !(await context.cookies(lab.origin)).some((cookie) => cookie.name === '__Host-sid'),
  )
  await page.screenshot({ path: `${folder}/rp-mobile.png`, fullPage: true })
  assert.deepEqual(errors, [])
  await writeFile(
    `${folder}/report.json`,
    JSON.stringify(
      {
        cases: [
          'login-code-pkce',
          'secure-httponly-samesite-cookie',
          'cookie-hidden-from-js',
          'authenticated-me',
          'logout-invalidates-copied-cookie',
        ],
        origin: 'ephemeral-loopback',
        productionIdentity: false,
      },
      null,
      2,
    ) + '\n',
  )
  console.log(folder)
} finally {
  await browser?.close()
  await lab.close()
}
