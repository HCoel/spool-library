import { formatGrams, levelLabel, unitLevel, unitRemaining } from '../core/amount.js'

export default function UnitRow({ lib, cap, unit, n, onOpen }) {
  const level = unitLevel(unit, cap)
  const grams = unitRemaining(unit, cap)
  const text = unit.amount_mode === 'level' ? `${levelLabel(level)} · ${formatGrams(grams, true)}` : formatGrams(grams)
  return (
    <button class="unit-row" onClick={onOpen} aria-label={`${lib.unit_label} #${n}`}>
      <span>#{n}</span>
      <span class="level"><span style={{ width: `${Math.round(level * 100)}%` }} /></span>
      <span>{text}</span>
      {unit.archived && <span class="muted">archived</span>}
    </button>
  )
}
