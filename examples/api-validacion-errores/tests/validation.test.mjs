import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import Ajv2020 from 'ajv/dist/2020.js'
import { ReservationInput, ReservationOutput, fieldErrors } from '../validation.mjs'

const schema = JSON.parse(
  await readFile(new URL('../reservation.schema.json', import.meta.url)),
)
const cases = JSON.parse(await readFile(new URL('../cases.json', import.meta.url)))
const validate = new Ajv2020({ allErrors: true, strict: true }).compile(schema)

test('Zod y JSON Schema coinciden en todos los casos compartidos sin mutar la entrada', () => {
  for (const item of cases) {
    const input = structuredClone(item.input)
    assert.equal(ReservationInput.safeParse(input).success, item.valid, item.name)
    assert.equal(validate(input), item.valid, item.name)
    assert.deepEqual(input, item.input)
  }
})

test('acumula fallos independientes y publica solo campos/códigos propios', () => {
  const result = ReservationInput.safeParse({
    sku: 'private-secret',
    quantity: 0,
    expectedVersion: '1',
    priority: 'urgent',
    'attacker-secret': true,
  })
  assert.equal(result.success, false)
  const errors = fieldErrors(result.error)
  assert.deepEqual(
    new Set(errors.map((x) => x.pointer)),
    new Set(['/sku', '/quantity', '/expectedVersion', '/priority', '']),
  )
  assert.ok(
    errors.every((x) => x.code === 'invalid_field' && Object.keys(x).length === 2),
  )
  assert.ok(!JSON.stringify(errors).includes('secret'))
})

test('refinement local: express admite como máximo cinco unidades', () => {
  const result = ReservationInput.safeParse({
    sku: 'BOOK',
    quantity: 6,
    expectedVersion: 1,
    priority: 'express',
  })
  assert.equal(result.success, false)
  assert.deepEqual(fieldErrors(result.error), [
    { pointer: '/quantity', code: 'invalid_field' },
  ])
})

test('el DTO de salida rechaza campos internos y versiones fuera de contrato', () => {
  const output = { sku: 'BOOK', reserved: 2, version: 2 }
  assert.deepEqual(ReservationOutput.parse(output), output)
  assert.equal(
    ReservationOutput.safeParse({ ...output, internalCost: 100 }).success,
    false,
  )
  assert.equal(ReservationOutput.safeParse({ ...output, version: '2' }).success, false)
})

test('fronteras de Unicode: ochenta code points pasan, ochenta y uno no', () => {
  const input = { sku: 'BOOK', quantity: 1, expectedVersion: 1, priority: 'standard' }
  for (const length of [80, 81]) {
    const value = { ...input, note: '📚'.repeat(length) }
    assert.equal(ReservationInput.safeParse(value).success, length === 80)
    assert.equal(validate(value), length === 80)
  }
})
