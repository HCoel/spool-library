import { describe, expect, test } from 'vitest'
import {
  LEVELS, formatGrams, isActive, isEstimate, levelLabel, productRemaining,
  setLevel, setWeight, unitLevel, unitRemaining,
} from '../../src/core/amount.js'

const cap = { net_g: 1000, empty_spool_g: 250 }

describe('unitRemaining', () => {
  test('level mode rounds level * net', () => {
    expect(unitRemaining({ amount_mode: 'level', level: 0.75 }, cap)).toBe(750)
  })
  test('weight mode subtracts empty spool', () => {
    expect(unitRemaining({ amount_mode: 'weight', gross_g: 850 }, cap)).toBe(600)
  })
  test('weight mode caps at net weight', () => {
    expect(unitRemaining({ amount_mode: 'weight', gross_g: 1400 }, cap)).toBe(1000)
  })
  // Review focus 1: reading below empty spool weight, including 0
  test.each([200, 0, 250])('weight %i at or below empty spool gives 0, never negative', g => {
    expect(unitRemaining({ amount_mode: 'weight', gross_g: g }, cap)).toBe(0)
  })
  test('count mode returns count', () => {
    expect(unitRemaining({ amount_mode: 'count', count: 5 }, cap)).toBe(5)
  })
})

describe('unitLevel', () => {
  test('derived from weight', () => {
    expect(unitLevel({ amount_mode: 'weight', gross_g: 750 }, cap)).toBe(0.5)
  })
  test('level mode returns stored level', () => {
    expect(unitLevel({ amount_mode: 'level', level: 0.25 }, cap)).toBe(0.25)
  })
})

describe('productRemaining', () => {
  test('sums only active (not archived, not deleted) units', () => {
    const units = [
      { amount_mode: 'level', level: 1 },
      { amount_mode: 'weight', gross_g: 650 },
      { amount_mode: 'level', level: 1, archived: true },
      { amount_mode: 'level', level: 1, deleted: true },
    ]
    expect(productRemaining(units, cap)).toBe(1400)
  })
})

describe('setters', () => {
  test('setLevel switches mode and clears weight', () => {
    expect(setLevel({ id: 'u', amount_mode: 'weight', gross_g: 900 }, 0.5))
      .toEqual({ id: 'u', amount_mode: 'level', level: 0.5, gross_g: null })
  })
  test('setWeight stores reading and derived level', () => {
    expect(setWeight({ id: 'u', amount_mode: 'level', level: 1 }, 750, cap))
      .toEqual({ id: 'u', amount_mode: 'weight', gross_g: 750, level: 0.5 })
  })
})

describe('formatting and flags', () => {
  test('formatGrams', () => {
    expect(formatGrams(600)).toBe('600 g')
    expect(formatGrams(1400, true)).toBe('~1.4 kg')
  })
  test('levelLabel', () => {
    expect(levelLabel(1)).toBe('Full')
    expect(levelLabel(0.1)).toBe('Low')
    expect(levelLabel(0.6)).toBe('60%')
  })
  test('isEstimate and isActive', () => {
    expect(isEstimate({ amount_mode: 'level' })).toBe(true)
    expect(isEstimate({ amount_mode: 'weight' })).toBe(false)
    expect(isActive({ archived: false })).toBe(true)
    expect(isActive({ archived: true })).toBe(false)
  })
  test('LEVELS has six steps from Full to Empty', () => {
    expect(LEVELS.map(l => l.value)).toEqual([1, 0.75, 0.5, 0.25, 0.1, 0])
  })
})
