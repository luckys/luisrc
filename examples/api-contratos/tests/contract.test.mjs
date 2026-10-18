import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { parseOrder, patchOrder } from '../server.mjs'

const api = JSON.parse(
  await readFile(new URL('../openapi.json', import.meta.url), 'utf8'),
)

// Verificador de tests para este subconjunto, no validador JSON Schema general.
function matches(value, schema) {
  const supported = [
    'type',
    'additionalProperties',
    'required',
    'properties',
    'minimum',
    'maximum',
    'enum',
    'maxLength',
    'pattern',
    'const',
  ]
  for (const key of Object.keys(schema))
    assert.ok(supported.includes(key), `Keyword nuevo sin verificar: ${key}`)
  const types = Array.isArray(schema.type) ? schema.type : [schema.type]
  const actual =
    value === null ? 'null' : Number.isInteger(value) ? 'integer' : typeof value
  if (!types.includes(actual)) return false
  if (schema.enum && !schema.enum.includes(value)) return false
  if ('const' in schema && value !== schema.const) return false
  if (
    actual === 'integer' &&
    ((schema.minimum !== undefined && value < schema.minimum) ||
      (schema.maximum !== undefined && value > schema.maximum))
  )
    return false
  if (
    actual === 'string' &&
    ((schema.maxLength !== undefined && [...value].length > schema.maxLength) ||
      (schema.pattern && !new RegExp(schema.pattern).test(value)))
  )
    return false
  if (actual === 'object') {
    if (Array.isArray(value)) return false
    if (schema.required?.some((key) => !(key in value))) return false
    for (const key of Object.keys(value)) {
      if (!schema.properties?.[key]) {
        if (schema.additionalProperties === false) return false
      } else if (!matches(value[key], schema.properties[key])) return false
    }
  }
  return true
}

test('OpenAPI local: cinco operaciones distintas y referencias internas resolubles', () => {
  assert.equal(api.openapi, '3.1.1')
  assert.deepEqual(Object.keys(api.paths), ['/orders', '/orders/{id}'])
  const ids = []
  for (const path of Object.values(api.paths))
    for (const [method, operation] of Object.entries(path)) {
      if (method === 'parameters') continue
      ids.push(operation.operationId)
      assert.ok(operation.responses.default)
    }
  assert.equal(ids.length, 5)
  assert.equal(new Set(ids).size, 5)
  for (const match of JSON.stringify(api).matchAll(
    /"\$ref":"#\/components\/schemas\/([^"]+)"/g,
  ))
    assert.ok(api.components.schemas[match[1]])
})

test('el esquema de entrada y el parser coinciden en fronteras, campos y Unicode', () => {
  const valid = { amountMinor: 1, currency: 'EUR' }
  const cases = [
    valid,
    { ...valid, amountMinor: 1000000 },
    { ...valid, label: '😀'.repeat(80) },
    null,
    [],
    {},
    { ...valid, amountMinor: 0 },
    { ...valid, amountMinor: 1000001 },
    { ...valid, amountMinor: 1.5 },
    { ...valid, amountMinor: '1' },
    { ...valid, currency: 'GBP' },
    { ...valid, label: null },
    { ...valid, label: '😀'.repeat(81) },
    { ...valid, admin: true },
  ]
  for (const value of cases) {
    let accepted = true
    try {
      parseOrder(value)
    } catch {
      accepted = false
    }
    assert.equal(
      accepted,
      matches(value, api.components.schemas.OrderInput),
      JSON.stringify(value),
    )
  }
})

test('el esquema parcial coincide con el parser y el resultado con Order', () => {
  const current = { id: 'o1', amountMinor: 1250, currency: 'EUR', label: 'Libro' }
  for (const patch of [
    {},
    { label: null },
    { label: '' },
    { label: '😀'.repeat(80) },
    { label: 'x'.repeat(81) },
    { amountMinor: 1 },
    null,
    [],
  ]) {
    let accepted = true
    try {
      assert.ok(matches(patchOrder(current, patch), api.components.schemas.Order))
    } catch {
      accepted = false
    }
    assert.equal(
      accepted,
      matches(patch, api.components.schemas.LabelPatch),
      JSON.stringify(patch),
    )
  }
})
