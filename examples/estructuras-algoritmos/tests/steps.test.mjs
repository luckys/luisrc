import test from 'node:test'
import assert from 'node:assert/strict'
import { binarySteps, insertionSteps, parseNumbers } from '../steps-model.mjs'
import { lowerBound } from '../algorithms.ts'
import { insertionSort } from '../focused.ts'

test('pasos de binaria coinciden con lowerBound y reducen el intervalo', () => {
  for (const input of [[], [2], [1, 2, 2, 4]])
    for (const target of [0, 1, 2, 3, 5]) {
      const steps = binarySteps(input, target)
      assert.equal(steps.at(-1).result, lowerBound(input, target))
      let size = input.length + 1
      for (const step of steps.filter((x) => x.middle !== undefined)) {
        assert.ok(step.high - step.low < size)
        size = step.high - step.low
      }
    }
  assert.throws(() => binarySteps([3, 1], 2), RangeError)
  assert.throws(() => binarySteps([1], NaN), RangeError)
})

test('pasos de inserción conservan snapshots y coinciden con la función probada', () => {
  const input = [4, 2, 3, 1]
  const steps = insertionSteps(input)
  assert.deepEqual(
    steps.at(-1).items,
    insertionSort(input, (a, b) => a - b),
  )
  assert.deepEqual(steps[0].items, input)
  assert.ok(new Set(steps.map((x) => x.items)).size === steps.length)
  assert.deepEqual(insertionSteps([]).at(-1).items, [])
})

test('entrada del visor: finitos, longitud acotada y vacíos deliberados', () => {
  assert.deepEqual(parseNumbers('2, 4, 4, 9'), [2, 4, 4, 9])
  assert.deepEqual(parseNumbers(''), [])
  for (const value of ['1,,2', 'Infinity', 'NaN', Array(22).fill('1').join(',')])
    assert.throws(() => parseNumbers(value), RangeError)
})
