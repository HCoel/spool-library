export function seededRandom(seed) {
  let h = 2166136261
  for (const c of String(seed)) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return () => {
    h += 0x6d2b79f5
    let t = h
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function sparklePoints(seed, count = 36) {
  const rnd = seededRandom(seed)
  return Array.from({ length: count }, () => ({
    x: 4 + rnd() * 92,
    y: 4 + rnd() * 92,
    r: 0.6 + rnd() * 1.4,
    o: 0.5 + rnd() * 0.5,
  }))
}

export function pieSlices(colors, cx = 50, cy = 50, r = 48) {
  const n = colors.length
  if (n < 2) return []
  return colors.map((color, i) => {
    const a0 = (i / n) * 2 * Math.PI - Math.PI / 2
    const a1 = ((i + 1) / n) * 2 * Math.PI - Math.PI / 2
    const x0 = (cx + r * Math.cos(a0)).toFixed(2)
    const y0 = (cy + r * Math.sin(a0)).toFixed(2)
    const x1 = (cx + r * Math.cos(a1)).toFixed(2)
    const y1 = (cy + r * Math.sin(a1)).toFixed(2)
    const large = a1 - a0 > Math.PI ? 1 : 0
    return { color, d: `M${cx} ${cy} L${x0} ${y0} A${r} ${r} 0 ${large} 1 ${x1} ${y1} Z` }
  })
}

export function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16)
  const channels = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(c =>
    Math.round(amount < 0 ? c * (1 + amount) : c + (255 - c) * amount))
  return `#${channels.map(c => c.toString(16).padStart(2, '0')).join('')}`
}
