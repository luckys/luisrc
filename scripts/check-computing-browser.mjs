import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { writeFile, mkdir } from 'node:fs/promises'
import { browserServer } from '../examples/computacion-redes/browser-server.mjs'

const require = createRequire(
  new URL('../examples/frontend-tiempo-real/package.json', import.meta.url),
)
const { chromium } = require('@playwright/test')
const a = await browserServer(),
  b = await browserServer()
const browser = await chromium.launch({ headless: true })
try {
  const page = await browser.newPage()
  await page.goto(a.origin, { waitUntil: 'networkidle' })
  await page.waitForFunction(() => window.lab?.authenticated === true)
  assert.equal(await page.evaluate(() => document.cookie.includes('lab_session')), false)
  assert.equal(
    await page.evaluate(() => localStorage.getItem('lab_example')),
    'visible-to-js',
  )
  const cross = await page.evaluate(async (origin) => {
    try {
      await fetch(`${origin}/api/whoami`, { credentials: 'include' })
      return false
    } catch {
      return true
    }
  }, b.origin)
  assert.equal(cross, true)
  assert.equal(b.requests.at(-1).cookie_received, true)
  await page.getByRole('button', { name: 'Bloquear 80 ms' }).click()
  await page.waitForFunction(
    () =>
      window.lab.events.some((x) => x.name === 'timer') &&
      window.lab.longTasks.length > 0,
  )
  const lab = await page.evaluate(() => ({
    events: window.lab.events,
    longTasks: window.lab.longTasks,
    navigation: performance.getEntriesByType('navigation')[0].toJSON(),
    authenticated: window.lab.authenticated,
  }))
  const names = lab.events.map((x) => x.name)
  assert.ok(names.indexOf('microtask') < names.indexOf('DOMContentLoaded'))
  assert.ok(names.indexOf('busy:end') < names.indexOf('timer'))
  assert.ok(lab.longTasks.some((x) => x.duration >= 50))
  // No conservar puertos efímeros como si fueran endpoints duraderos.
  delete lab.navigation.name
  if (process.argv.includes('--record')) {
    await mkdir('examples/computacion-redes/results', { recursive: true })
    await writeFile(
      'examples/computacion-redes/results/browser.json',
      JSON.stringify(
        {
          browser: browser.version(),
          ...lab,
          http_only_not_readable: true,
          cors_read_rejected: cross,
          cross_origin_cookie_received: b.requests.at(-1).cookie_received,
        },
        null,
        2,
      ) + '\n',
    )
  }
  console.log('P009: Fetch con cookie HttpOnly, CORS y long task observados en Chromium')
} finally {
  await browser.close()
  await a.close()
  await b.close()
}
