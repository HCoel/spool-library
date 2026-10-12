import { useState } from 'preact/hooks'
import { LEVELS, formatGrams, setLevel, setWeight, unitRemaining } from '../core/amount.js'
import { repo } from '../store.js'
import { guard } from './toast.jsx'

export default function UnitSheet({ lib, cap, unit, n, onClose }) {
  const [weight, setWeightText] = useState(unit?.gross_g ?? '')
  const [location, setLocation] = useState(unit?.location ?? '')
  if (!unit) return null

  const label = `${lib.unit_label} #${n}`
  const save = u => guard(() => repo.saveUnit(u))
  const grams = weight === '' ? null : Number(weight)
  const weightError = grams !== null && (!Number.isFinite(grams) || grams < 0) ? 'Enter 0 or more' : null
  const preview = grams !== null && !weightError ? unitRemaining({ amount_mode: 'weight', gross_g: grams }, cap) : null

  const commitWeight = () => {
    if (grams === null || weightError || grams === unit.gross_g) return
    save(setWeight(unit, grams, cap))
  }

  async function toggleArchive() {
    await save({ ...unit, archived: !unit.archived })
    onClose()
  }

  async function remove() {
    if (!confirm(`Delete ${label}?`)) return
    await guard(() => repo.deleteUnit(unit.id))
    onClose()
  }

  return (
    <div class="sheet-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div class="sheet" role="dialog" aria-label={label}>
        <header class="bar">
          <h2 style="flex:1;margin:0">{label}</h2>
          <button onClick={onClose}>Done</button>
        </header>
        <div class="chips" role="group" aria-label="Level">
          {LEVELS.map(l => (
            <button key={l.value} aria-pressed={unit.amount_mode === 'level' && unit.level === l.value}
              onClick={() => { setWeightText(''); save(setLevel(unit, l.value)) }}>{l.label}</button>
          ))}
        </div>
        <label for="gross">Scale reading (g)</label>
        <input id="gross" type="number" inputmode="numeric" value={weight}
          onInput={e => setWeightText(e.currentTarget.value)}
          onBlur={commitWeight}
          onKeyDown={e => e.key === 'Enter' && commitWeight()} />
        {weightError && <div class="error">{weightError}</div>}
        {preview !== null && (
          <p>
            → {formatGrams(preview)} left
            {grams < cap.empty_spool_g && <span class="error"> - below the empty spool weight ({cap.empty_spool_g} g), check it</span>}
          </p>
        )}
        <label for="location">Location</label>
        <input id="location" value={location} onInput={e => setLocation(e.currentTarget.value)}
          onBlur={() => location !== unit.location && save({ ...unit, location })} />
        <div class="row">
          <button onClick={toggleArchive}>{unit.archived ? 'Unarchive' : 'Archive'}</button>
          <button class="danger" onClick={remove}>Delete</button>
        </div>
      </div>
    </div>
  )
}
