import { expect, test } from 'vitest'
import { pieSlices, shade, sparklePoints } from '../../src/libraries/filament/swatch-geometry.js'

test('sparklePoints is deterministic per seed and inside the swatch', () => {
  const a = sparklePoints('abc')
  expect(sparklePoints('abc')).toEqual(a)
  expect(sparklePoints('abd')).not.toEqual(a)
  expect(a).toHaveLength(36)
  for (const p of a) {
    expect(p.x).toBeGreaterThanOrEqual(0)
    expect(p.x).toBeLessThanOrEqual(100)
    expect(p.y).toBeGreaterThanOrEqual(0)
    expect(p.y).toBeLessThanOrEqual(100)
  }
})

test('pieSlices makes one slice per colour starting at the top', () => {
  const s = pieSlices(['#ff0000', '#0000ff'])
  expect(s).toHaveLength(2)
  expect(s[0].color).toBe('#ff0000')
  expect(s[0].d.startsWith('M50 50 L50.00 2.00')).toBe(true)
  expect(pieSlices(['#ff0000', '#00ff00', '#0000ff'])).toHaveLength(3)
})

test('pieSlices returns nothing for fewer than two colours', () => {
  expect(pieSlices(['#ff0000'])).toEqual([])
})

test('shade darkens and lightens', () => {
  expect(shade('#808080', -0.5)).toBe('#404040')
  expect(shade('#000000', 1)).toBe('#ffffff')
})
