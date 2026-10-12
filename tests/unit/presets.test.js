import { expect, test } from 'vitest'
import { diffOverrides, effectiveSettings } from '../../src/core/presets.js'

const keys = ['nozzle_min', 'nozzle_max', 'bed_min']
const preset = { nozzle_min: 190, nozzle_max: 230, bed_min: 55 }

test('effectiveSettings merges overrides and reports which differ', () => {
  const { values, overridden } = effectiveSettings(keys, preset, { nozzle_max: 240, bed_min: 55 })
  expect(values).toEqual({ nozzle_min: 190, nozzle_max: 240, bed_min: 55 })
  expect([...overridden]).toEqual(['nozzle_max'])
})

test('effectiveSettings treats null override as "use preset"', () => {
  const { values, overridden } = effectiveSettings(keys, preset, { nozzle_min: null })
  expect(values.nozzle_min).toBe(190)
  expect(overridden.size).toBe(0)
})

test('effectiveSettings tolerates missing preset and overrides', () => {
  expect(effectiveSettings(keys, undefined, undefined).values).toEqual({ nozzle_min: null, nozzle_max: null, bed_min: null })
})

test('diffOverrides keeps only non-null values that differ', () => {
  expect(diffOverrides(keys, preset, { nozzle_min: 190, nozzle_max: 245, bed_min: null })).toEqual({ nozzle_max: 245 })
})
