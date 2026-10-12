import { expect, test } from 'vitest'
import { fitWithin } from '../../src/core/image.js'

test('scales the long edge down to the max', () => {
  expect(fitWithin(4032, 3024, 1200)).toEqual({ width: 1200, height: 900 })
  expect(fitWithin(3024, 4032, 1200)).toEqual({ width: 900, height: 1200 })
})

test('never upscales', () => {
  expect(fitWithin(800, 600, 1200)).toEqual({ width: 800, height: 600 })
})
