export const LEVELS = [
  { value: 1, label: 'Full' },
  { value: 0.75, label: '3/4' },
  { value: 0.5, label: '1/2' },
  { value: 0.25, label: '1/4' },
  { value: 0.1, label: 'Low' },
  { value: 0, label: 'Empty' },
]

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

export function unitRemaining(unit, cap) {
  if (unit.amount_mode === 'count') return unit.count ?? 0
  if (unit.amount_mode === 'weight') return clamp((unit.gross_g ?? 0) - cap.empty_spool_g, 0, cap.net_g)
  return Math.round((unit.level ?? 0) * cap.net_g)
}

export function unitLevel(unit, cap) {
  if (unit.amount_mode === 'weight') return cap.net_g > 0 ? unitRemaining(unit, cap) / cap.net_g : 0
  return unit.level ?? 0
}

export function isEstimate(unit) {
  return unit.amount_mode === 'level'
}

export function isActive(unit) {
  return !unit.deleted && !unit.archived
}

export function productRemaining(units, cap) {
  return units.filter(isActive).reduce((sum, u) => sum + unitRemaining(u, cap), 0)
}

export function setLevel(unit, level) {
  return { ...unit, amount_mode: 'level', level, gross_g: null }
}

export function setWeight(unit, gross_g, cap) {
  const next = { ...unit, amount_mode: 'weight', gross_g }
  return { ...next, level: unitLevel(next, cap) }
}

export function formatGrams(g, estimate = false) {
  const text = g >= 1000 ? `${(g / 1000).toFixed(1)} kg` : `${g} g`
  return estimate ? `~${text}` : text
}

export function levelLabel(level) {
  return LEVELS.find(l => l.value === level)?.label ?? `${Math.round(level * 100)}%`
}
