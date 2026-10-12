import { expect, test } from 'vitest'
import { checkOrder, checkRange } from '../../src/core/validate.js'

test('checkRange: blank optional is fine, blank required errors', () => {
  const e = {}
  checkRange(e, 'a', null, 0, 10)
  checkRange(e, 'b', undefined, 0, 10, { required: true })
  expect(e).toEqual({ b: 'Required' })
})

test('checkRange: out of range and non-numbers error', () => {
  const e = {}
  checkRange(e, 'low', -1, 0, 10)
  checkRange(e, 'high', 11, 0, 10)
  checkRange(e, 'nan', Number.NaN, 0, 10)
  checkRange(e, 'ok', 10, 0, 10)
  expect(e).toEqual({ low: 'Must be 0-10', high: 'Must be 0-10', nan: 'Must be 0-10' })
})

test('checkOrder flags max below min, skips when blank or already errored', () => {
  const e = { c: 'Must be 0-10' }
  checkOrder(e, 'a', 5, 4)
  checkOrder(e, 'b', null, 4)
  checkOrder(e, 'c', 9, 1)
  expect(e).toEqual({ a: 'Max must be at least min', c: 'Must be 0-10' })
})
