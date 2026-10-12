import { describe, expect, test } from 'vitest'
import {
  FINISHES, MATERIALS, capOf, defaultName, editableName, facets, formatPresetLine, formatRange,
  newFields, presets, summary, validate, validateSettings,
} from '../../src/libraries/filament/definition.js'

const product = (fields = {}, extra = {}) => ({ library: 'filament', brand: 'Bambu', name: 'x', fields: { ...newFields(), ...fields }, ...extra })

describe('catalogue lists', () => {
  test('materials include the support and wood types', () => {
    expect(MATERIALS).toEqual(expect.arrayContaining(['PLA Wood', 'PLA Support', 'PLA/PETG Support']))
  })
  test('finishes include wood', () => {
    expect(FINISHES).toContain('wood')
  })
  test('every material has a preset', () => {
    for (const m of MATERIALS) expect(presets[m]).toBeDefined()
  })
  test('support presets match the Bambu datasheets', () => {
    expect(presets['PLA Support']).toEqual({ nozzle_min: 220, nozzle_max: 230, bed_min: 35, bed_max: 45, dry_temp: 55, dry_hours: 8, speed_max: 200 })
    expect(presets['PLA/PETG Support']).toEqual({ nozzle_min: 190, nozzle_max: 240, bed_min: 35, bed_max: 60, dry_temp: 75, dry_hours: 8, speed_max: 100 })
    expect(presets['PLA Wood']).toEqual({ nozzle_min: 210, nozzle_max: 235, bed_min: 45, bed_max: 60, dry_temp: null, dry_hours: null, speed_max: 150 })
  })
})

describe('defaultName', () => {
  test('joins brand, material and colour name', () => {
    expect(defaultName(product({ material: 'PETG', color_name: 'Jade White' }))).toBe('Bambu PETG Jade White')
  })
  // Review focus 2: everything optional blank
  test('falls back to the material when brand and colour name are blank', () => {
    expect(defaultName(product({ material: 'PETG', color_name: '  ' }, { brand: '' }))).toBe('PETG')
  })
})

describe('editableName', () => {
  test('auto-derived names come back blank so they keep tracking edits', () => {
    expect(editableName(product({ material: 'PETG', color_name: 'Jade' }, { name: 'Bambu PETG Jade' }))).toBe('')
  })
  test('custom names are kept', () => {
    expect(editableName(product({}, { name: 'My spool' }))).toBe('My spool')
  })
})

describe('validate', () => {
  test('defaults are valid', () => {
    expect(validate(product(), presets.PLA)).toEqual({})
  })
  test('bad hex, material, finish and weights', () => {
    const e = validate(product({ color_hex: 'red', material: 'Cheese', finish: 'shiny', net_g: 0, empty_spool_g: null }), {})
    expect(e).toMatchObject({ color_hex: 'Use #RRGGBB', material: 'Pick a material', finish: 'Pick a finish', net_g: 'Must be 1-5000', empty_spool_g: 'Required' })
  })
  // Review focus 5: multi finish without a valid second colour
  test('multi finish needs a valid second colour', () => {
    expect(validate(product({ finish: 'multi', color_hex_2: null }), presets.PLA).color_hex_2).toMatch(/second colour/)
    expect(validate(product({ finish: 'multi', color_hex_2: '#12' }), presets.PLA).color_hex_2).toMatch(/second colour/)
    expect(validate(product({ finish: 'multi', color_hex_2: '#123456', color_hex_3: 'zzz' }), presets.PLA)).toEqual({ color_hex_3: 'Use #RRGGBB' })
  })
  test('hidden extra colours are ignored unless the finish is multi', () => {
    expect(validate(product({ finish: 'basic', color_hex_2: '#12', color_hex_3: 'zz' }), presets.PLA)).toEqual({})
  })
  test('override that pushes nozzle min above preset max is an error', () => {
    expect(validate(product({ overrides: { nozzle_min: 240 } }), presets.PLA).nozzle_max).toBe('Max must be at least min')
  })
})

describe('validateSettings', () => {
  test('ranges', () => {
    expect(validateSettings({ nozzle_min: 100, nozzle_max: 400, bed_min: 50, bed_max: 40, dry_temp: 20, dry_hours: 60, speed_max: 0 })).toEqual({
      nozzle_min: 'Must be 150-350', nozzle_max: 'Must be 150-350', bed_max: 'Max must be at least min',
      dry_temp: 'Must be 30-100', dry_hours: 'Must be 1-48', speed_max: 'Must be 1-1000',
    })
  })
  test('all blank is valid', () => {
    expect(validateSettings(presets.Other)).toEqual({})
  })
})

describe('formatting', () => {
  test('formatRange', () => {
    expect(formatRange(190, 230, '°C')).toBe('190-230 °C')
    expect(formatRange(55, 55, '°C')).toBe('55 °C')
    expect(formatRange(null, 60, '°C')).toBe('60 °C')
    expect(formatRange(null, null, '°C')).toBeNull()
  })
  test('formatPresetLine', () => {
    expect(formatPresetLine(presets.PLA)).toBe('190-230 °C · bed 55-60 °C')
    expect(formatPresetLine(presets.Other)).toBe('No settings')
  })
})

describe('facets and summary', () => {
  test('facets read material, finish and colour family', () => {
    const p = product({ material: 'PETG', finish: 'silk', color_hex: '#1E90FF' })
    expect(Object.fromEntries(facets.map(f => [f.key, f.get(p)]))).toEqual({ material: 'PETG', finish: 'silk', color: 'blue' })
  })
  test('summary counts active spools and marks estimates', () => {
    const p = product()
    const units = [{ amount_mode: 'level', level: 1 }, { amount_mode: 'level', level: 0.5 }, { amount_mode: 'level', level: 1, archived: true }]
    expect(summary(p, units)).toBe('PLA · ×2 · ~1.5 kg')
  })
  test('capOf', () => {
    expect(capOf(product({ net_g: 500, empty_spool_g: 180 }))).toEqual({ net_g: 500, empty_spool_g: 180 })
  })
})
