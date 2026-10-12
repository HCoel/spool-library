import { COLOR_FAMILIES, colorFamily, isHex } from '../../core/color.js'
import { formatGrams, isActive, isEstimate, productRemaining } from '../../core/amount.js'
import { effectiveSettings } from '../../core/presets.js'
import { checkOrder, checkRange } from '../../core/validate.js'

export const MATERIALS = ['PLA', 'PETG', 'ABS', 'ASA', 'TPU', 'Nylon', 'PLA Wood', 'PLA Support', 'PLA/PETG Support', 'Other']
export const FINISHES = ['basic', 'matte', 'silk', 'sparkle', 'translucent', 'multi', 'glow', 'wood']
export const SETTING_KEYS = ['nozzle_min', 'nozzle_max', 'bed_min', 'bed_max', 'dry_temp', 'dry_hours', 'speed_max']
export const SETTING_LABELS = {
  nozzle_min: 'Nozzle min',
  nozzle_max: 'Nozzle max',
  bed_min: 'Bed min',
  bed_max: 'Bed max',
  dry_temp: 'Dry °C',
  dry_hours: 'Dry hours',
  speed_max: 'Max speed (mm/s)',
}

const s = (nozzle_min, nozzle_max, bed_min, bed_max, dry_temp, dry_hours, speed_max) =>
  ({ nozzle_min, nozzle_max, bed_min, bed_max, dry_temp, dry_hours, speed_max })

export const presets = {
  PLA: s(190, 230, 55, 60, 55, 8, null),
  PETG: s(230, 260, 70, 80, 65, 8, null),
  ABS: s(240, 270, 90, 100, 80, 8, null),
  ASA: s(240, 270, 90, 100, 80, 8, null),
  TPU: s(210, 240, 30, 35, 70, 8, null),
  Nylon: s(260, 290, 80, 100, 80, 12, null),
  'PLA Wood': s(210, 235, 45, 60, null, null, 150),
  'PLA Support': s(220, 230, 35, 45, 55, 8, 200),
  'PLA/PETG Support': s(190, 240, 35, 60, 75, 8, 100),
  Other: s(null, null, null, null, null, null, null),
}

export const preset_key = 'material'

export function newFields() {
  return {
    material: 'PLA',
    color_name: '',
    color_hex: '#888888',
    color_hex_2: null,
    color_hex_3: null,
    finish: 'basic',
    diameter: 1.75,
    net_g: 1000,
    empty_spool_g: 250,
    overrides: {},
  }
}

export function defaultName(product) {
  return [product.brand, product.fields.material, product.fields.color_name]
    .map(v => (v ?? '').trim())
    .filter(Boolean)
    .join(' ')
}

// A stored name equal to the derived one was auto-generated: edit it as blank so it keeps tracking changes
export function editableName(product) {
  return product.name === defaultName(product) ? '' : product.name
}

export function capOf(product) {
  return { net_g: product.fields.net_g, empty_spool_g: product.fields.empty_spool_g }
}

export function formatRange(min, max, unit) {
  if (min == null && max == null) return null
  if (min == null || max == null || min === max) return `${min ?? max} ${unit}`
  return `${min}-${max} ${unit}`
}

export function formatPresetLine(preset) {
  const nozzle = formatRange(preset.nozzle_min, preset.nozzle_max, '°C')
  const bed = formatRange(preset.bed_min, preset.bed_max, '°C')
  return [nozzle, bed && `bed ${bed}`].filter(Boolean).join(' · ') || 'No settings'
}

export function validateSettings(v) {
  const e = {}
  checkRange(e, 'nozzle_min', v.nozzle_min, 150, 350)
  checkRange(e, 'nozzle_max', v.nozzle_max, 150, 350)
  checkOrder(e, 'nozzle_max', v.nozzle_min, v.nozzle_max)
  checkRange(e, 'bed_min', v.bed_min, 0, 120)
  checkRange(e, 'bed_max', v.bed_max, 0, 120)
  checkOrder(e, 'bed_max', v.bed_min, v.bed_max)
  checkRange(e, 'dry_temp', v.dry_temp, 30, 100)
  checkRange(e, 'dry_hours', v.dry_hours, 1, 48)
  checkRange(e, 'speed_max', v.speed_max, 1, 1000)
  return e
}

export function validate(product, preset = {}) {
  const f = product.fields
  const e = {}
  if (!MATERIALS.includes(f.material)) e.material = 'Pick a material'
  if (!FINISHES.includes(f.finish)) e.finish = 'Pick a finish'
  if (!isHex(f.color_hex)) e.color_hex = 'Use #RRGGBB'
  // Extra colours are only shown (and only matter) for the multi finish
  if (f.finish === 'multi') {
    if (!isHex(f.color_hex_2)) e.color_hex_2 = 'Multi needs a second colour (#RRGGBB)'
    if (f.color_hex_3 != null && !isHex(f.color_hex_3)) e.color_hex_3 = 'Use #RRGGBB'
  }
  checkRange(e, 'diameter', f.diameter, 0.5, 5, { required: true })
  checkRange(e, 'net_g', f.net_g, 1, 5000, { required: true })
  checkRange(e, 'empty_spool_g', f.empty_spool_g, 1, 5000, { required: true })
  Object.assign(e, validateSettings(effectiveSettings(SETTING_KEYS, preset, f.overrides).values))
  return e
}

export const facets = [
  { key: 'material', label: 'Material', options: MATERIALS, get: p => p.fields.material },
  { key: 'finish', label: 'Finish', options: FINISHES, get: p => p.fields.finish },
  { key: 'color', label: 'Colour', options: COLOR_FAMILIES, get: p => colorFamily(p.fields.color_hex) },
]

export function summary(product, units) {
  const active = units.filter(isActive)
  const grams = productRemaining(units, capOf(product))
  return `${product.fields.material} · ×${active.length} · ${formatGrams(grams, active.some(isEstimate))}`
}
