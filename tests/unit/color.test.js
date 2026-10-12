import { describe, expect, test } from 'vitest'
import { colorFamily, hexToHsl, isHex } from '../../src/core/color.js'

describe('isHex', () => {
  test.each(['#E63946', '#ffffff', '#000000'])('accepts %s', v => expect(isHex(v)).toBe(true))
  test.each(['E63946', '#fff', '#GGGGGG', '', null, undefined, '#1234567'])('rejects %s', v => expect(isHex(v)).toBe(false))
})

describe('hexToHsl', () => {
  test('pure red', () => {
    expect(hexToHsl('#ff0000')).toEqual({ h: 0, s: 100, l: 50 })
  })
})

describe('colorFamily', () => {
  test.each([
    ['#E63946', 'red'],
    ['#FF8C00', 'orange'],
    ['#8B4513', 'orange'], // brown lands in orange (documented)
    ['#FFD700', 'yellow'],
    ['#2E8B57', 'green'],
    ['#1E90FF', 'blue'],
    ['#8A2BE2', 'purple'],
    ['#000000', 'neutral'],
    ['#FFFFFF', 'neutral'],
    ['#808080', 'neutral'],
    ['not-a-hex', 'neutral'],
  ])('%s -> %s', (hex, family) => expect(colorFamily(hex)).toBe(family))
})
