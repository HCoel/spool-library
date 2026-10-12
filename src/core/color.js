export const HEX_RE = /^#[0-9a-fA-F]{6}$/

export function isHex(v) {
  return typeof v === 'string' && HEX_RE.test(v)
}

export function hexToHsl(hex) {
  const n = parseInt(hex.slice(1), 16)
  const r = ((n >> 16) & 255) / 255
  const g = ((n >> 8) & 255) / 255
  const b = (n & 255) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  let h = 0
  let s = 0
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0)
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60
  }
  return { h, s: s * 100, l: l * 100 }
}

export const COLOR_FAMILIES = ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'neutral']

export function colorFamily(hex) {
  if (!isHex(hex)) return 'neutral'
  const { h, s, l } = hexToHsl(hex)
  if (s < 15 || l < 12 || l > 92) return 'neutral'
  if (h >= 345 || h < 15) return 'red'
  if (h < 45) return 'orange'
  if (h < 70) return 'yellow'
  if (h < 170) return 'green'
  if (h < 260) return 'blue'
  return 'purple'
}

// Rainbow order (red to purple by hue), then neutrals dark to light; invalid colours last
export function colorSortKey(hex) {
  if (!isHex(hex)) return 9999
  const family = colorFamily(hex)
  const { h, l } = hexToHsl(hex)
  if (family === 'neutral') return 7000 + l
  // Shift hue so reds just below 360 sort with the reds at the start
  return COLOR_FAMILIES.indexOf(family) * 1000 + ((h + 15) % 360)
}
