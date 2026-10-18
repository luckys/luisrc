import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { once } from 'node:events'
import Ajv2020 from 'ajv/dist/2020.js'
import { createApi } from '../server.mjs'
const api = JSON.parse(await readFile(new URL('../openapi.json', import.meta.url)))
const ajv = new Ajv2020({ strict: true, allErrors: true })
const definitions = JSON.parse(
  JSON.stringify(api.components.schemas).replaceAll('#/components/schemas/', '#/$defs/'),
)
const validators = ['PageV1', 'PageV2'].map((name) =>
  ajv.compile({ $defs: definitions, $ref: `#/$defs/${name}` }),
)

test('OpenAPI conserva dos operaciones únicas y todas sus referencias internas existen', () => {
  assert.equal(api.openapi, '3.1.1')
  const operations = Object.values(api.paths).map((path) => path.get.operationId)
  assert.equal(new Set(operations).size, 2)
  function visit(value) {
    if (!value || typeof value !== 'object') return
    if (value.$ref)
      assert.ok(
        value.$ref
          .slice(2)
          .split('/')
          .reduce((node, key) => node?.[key], api),
        value.$ref,
      )
    Object.values(value).forEach(visit)
  }
  visit(api)
})

test('respuesta HTTP real satisface cada schema y conserva el significado monetario', async (t) => {
  const row = {
    id: '1',
    created_at: new Date('2026-01-01Z'),
    amount_minor: 1250,
    currency: 'EUR',
    status: 'paid',
    description: 'Libro',
  }
  const server = createApi({
    pool: {
      async query() {
        return { rows: [row] }
      },
    },
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(async () => {
    server.closeIdleConnections()
    await new Promise((resolve) => server.close(resolve))
  })
  const origin = `http://127.0.0.1:${server.address().port}`
  for (const [index, version] of ['v1', 'v2'].entries()) {
    const body = await (await fetch(`${origin}/${version}/orders`)).json()
    assert.equal(validators[index](body), true, JSON.stringify(validators[index].errors))
    assert.equal(
      version === 'v1' ? body.items[0].amountMinor : body.items[0].money.minorUnits,
      1250,
    )
    if (version === 'v1') {
      const changed = structuredClone(body)
      changed.items[0].amountMinor = 12
      assert.equal(
        validators[index](changed),
        true,
        'Un schema no conoce la unidad monetaria de una observación',
      )
      assert.notEqual(
        changed.items[0].amountMinor,
        row.amount_minor,
        'La aserción semántica detecta el cambio que el schema permite',
      )
    }
  }
})
