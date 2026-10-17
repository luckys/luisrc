import { test, expect } from '@playwright/test'

test('teclado: saltar, etiquetar, editar y guardar sin ratón', async ({ page }) => {
  await page.goto('/')
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: 'Saltar al contenido' })).toBeFocused()
  await page.keyboard.press('Enter')
  await page.keyboard.press('Tab')
  await expect(page.getByLabel('Nombre del pedido')).toBeFocused()
  await page.keyboard.press('ControlOrMeta+A')
  await page.keyboard.type('Nombre desde teclado')
  await page.keyboard.press('Tab')
  await page.keyboard.press('Tab')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('status')).toHaveText('Cambios guardados')
})

test('SSR contiene datos sin JavaScript; CSR no los incluye en root', async ({
  browser,
  request,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false })
  const page = await context.newPage()
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Editar pedido' })).toBeVisible()
  const csr = await request.get('/?mode=csr')
  expect(await csr.text()).toContain('<div id="root"></div>')
  await context.close()
})

test('hydration: CSR y SSR permiten editar sin errores de React', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  for (const mode of ['ssr', 'csr']) {
    await page.goto(`/?mode=${mode}`)
    await page.getByLabel('Nombre del pedido').fill('Interacción')
    await expect(page.getByLabel('Nombre del pedido')).toHaveValue('Interacción')
  }
  expect(errors).toEqual([])
})

test('optimismo: muestra el nombre nuevo antes de responder y revierte ante rechazo', async ({
  page,
}) => {
  await page.goto('/')
  const previous = await page.getByTestId('order-name').textContent()
  let release!: () => void
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route('**/api/order', async (route) => {
    await gate
    await route.fulfill({ status: 409, json: { error: 'conflict' } })
  })
  await page.getByLabel('Nombre del pedido').fill('Optimista')
  await page.getByRole('button', { name: 'Guardar', exact: true }).click()
  await expect(page.getByTestId('order-name')).toHaveText('Optimista')
  release()
  await expect(page.getByTestId('order-name')).toHaveText(previous!)
  await expect(page.getByRole('status')).toContainText('No se pudo guardar')
})

test('búsqueda: un cambio rápido mantiene solo el resultado actual', async ({ page }) => {
  await page.route('**/api/search?*', async (route) => {
    const query = new URL(route.request().url()).searchParams.get('q')
    await route.fulfill({
      json: [query === 'nuevo' ? 'Resultado nuevo' : 'Resultado anterior'],
    })
  })
  await page.goto('/?view=search')
  await page.getByLabel('Buscar entregas').fill('anterior')
  await page.getByLabel('Buscar entregas').fill('nuevo')
  await expect(page.getByRole('listitem')).toHaveText('Resultado nuevo')
})

test('virtualización: DOM acotado al principio y al final', async ({ page }) => {
  await page.goto('/?view=performance')
  await expect(page.getByRole('listitem')).toHaveCount(12)
  await page
    .getByRole('region', { name: 'Vista virtual de entregas' })
    .evaluate((node) => {
      node.scrollTop = node.scrollHeight
    })
  await expect(page.getByRole('listitem').last()).toHaveText('Entrega 100000')
  expect(await page.getByRole('listitem').count()).toBeLessThanOrEqual(14)
})

test('paginación: cambia 20 filas y lleva el foco al título', async ({ page }) => {
  await page.goto('/?view=table')
  await expect(page.getByRole('row')).toHaveCount(21)
  await page.getByRole('button', { name: 'Siguiente' }).click()
  await expect(page.getByRole('heading', { name: 'Página 2' })).toBeFocused()
  await expect(page.getByRole('rowheader').first()).toHaveText('d21')
})

test('responsive: formulario y casos de componentes caben en 360px', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 })
  for (const view of ['orders', 'components', 'table']) {
    await page.goto(`/?view=${view}`)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true)
  }
})

test('SSE: reanuda y obtiene snapshot cuando el historial ya no alcanza', async ({
  page,
  request,
}) => {
  await page.goto('/?view=events')
  await page.getByRole('button', { name: 'Generar evento' }).click()
  await expect(page.locator('p[role="status"]')).toHaveText('Sincronizado')
  const before = Number(await page.locator('output').textContent())
  await page.getByRole('button', { name: 'Desconectar', exact: true }).click()
  for (let index = 0; index < 12; index++) await request.post('/api/event')
  await page.getByRole('button', { name: 'Reconectar', exact: true }).click()
  await expect(page.locator('p[role="status"]')).toHaveText('Snapshot recuperado')
  await expect(page.locator('output')).toHaveText(String(before + 12))
})

test('Yjs: dos pestañas convergen al reconectar tras ediciones desconectadas', async ({
  context,
}) => {
  const a = await context.newPage()
  const b = await context.newPage()
  await a.goto('/?view=note')
  await b.goto('/?view=note')
  for (const page of [a, b])
    await page.getByRole('button', { name: 'Desconectar nota' }).click()
  await a.getByLabel('Fragmento').fill('A')
  await a.getByRole('button', { name: 'Añadir' }).click()
  await b.getByLabel('Fragmento').fill('B')
  await b.getByRole('button', { name: 'Añadir' }).click()
  for (const page of [a, b])
    await page.getByRole('button', { name: 'Reconectar nota' }).click()
  await expect(a.getByTestId('note')).toHaveText(/^(AB|BA)$/)
  await expect(b.getByTestId('note')).toHaveText(
    (await a.getByTestId('note').textContent()) ?? '',
  )
  await a.reload()
  await expect(a.getByTestId('note')).toHaveText(/^(AB|BA)$/)
})

test('WebRTC: transporta audio sintético local y libera la llamada', async ({ page }) => {
  await page.goto('/?view=media')
  await page.getByRole('button', { name: 'Iniciar audio' }).click()
  await expect(page.getByRole('status')).toContainText('Conexión creada', {
    timeout: 15000,
  })
  await expect
    .poll(async () => {
      await page.getByRole('button', { name: 'Consultar estadísticas' }).click()
      const status = await page.getByRole('status').textContent()
      return Number(status?.match(/recibidos: (\d+)/)?.[1] ?? 0)
    })
    .toBeGreaterThan(0)
  await page.getByRole('button', { name: 'Colgar' }).click()
  await expect(page.getByRole('status')).toHaveText('Llamada finalizada')
  expect(
    await page.locator('audio').evaluate((node: HTMLAudioElement) => node.srcObject),
  ).toBeNull()
})

test('WebRTC: una captura tardía se detiene después de colgar', async ({ page }) => {
  await page.addInitScript(() => {
    const state = window as unknown as {
      finishCapture?: () => void
      captured?: MediaStream
    }
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices)
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      const stream = await original(constraints)
      state.captured = stream
      return new Promise<MediaStream>((resolve) => {
        state.finishCapture = () => resolve(stream)
      })
    }
  })
  await page.goto('/?view=media')
  await page.getByRole('button', { name: 'Iniciar audio' }).click()
  await expect
    .poll(() => page.evaluate(() => Boolean((window as any).finishCapture)))
    .toBe(true)
  await page.getByRole('button', { name: 'Colgar' }).click()
  await page.evaluate(() => (window as any).finishCapture())
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as any).captured
          .getTracks()
          .every((track: MediaStreamTrack) => track.readyState === 'ended'),
      ),
    )
    .toBe(true)
  await expect(page.getByRole('status')).toHaveText('Llamada finalizada')
  await expect(page.getByRole('button', { name: 'Iniciar audio' })).toBeEnabled()
})

test('WebRTC: rechazar permiso deja disponible otro intento', async ({ page }) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      throw new DOMException('Denegado', 'NotAllowedError')
    }
  })
  await page.goto('/?view=media')
  await page.getByRole('button', { name: 'Iniciar audio' }).click()
  await expect(page.getByRole('status')).toContainText('NotAllowedError')
  await expect(page.getByRole('button', { name: 'Iniciar audio' })).toBeEnabled()
})

test('SSE: una desconexión corta recupera eventos mediante replay', async ({
  page,
  request,
}) => {
  await page.goto('/?view=events')
  await page.getByRole('button', { name: 'Generar evento' }).click()
  await expect(page.locator('p[role="status"]')).toHaveText('Sincronizado')
  const before = Number(await page.locator('output').textContent())
  await page.getByRole('button', { name: 'Desconectar', exact: true }).click()
  await request.post('/api/event')
  await request.post('/api/event')
  await page.getByRole('button', { name: 'Reconectar', exact: true }).click()
  await expect(page.locator('output')).toHaveText(String(before + 2))
  await expect(page.locator('p[role="status"]')).toHaveText('Sincronizado')
})
