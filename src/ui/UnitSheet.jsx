import { useState } from 'preact/hooks'
import { LEVELS, formatGrams, unitLevel, unitRemaining } from '../core/amount.js'
import { repo } from '../store.js'
import { guard } from './toast.jsx'

export default function UnitSheet({ lib, cap, unit, n, onClose }) {
  const [weight, setWeightText] = useState(unit?.gross_g ?? '')
  const [location, setLocation] = useState(unit?.location ?? '')
  if (!unit) return null

  const label = `${lib.unit_label} #${n}`
  // Patch only the fields each action changes: actions fire faster than liveQuery re-renders,
  // so writing a whole record built from the `unit` prop would undo the previous action
  const patch = fields => guard(() => repo.updateUnit(unit.id, fields))
  const grams = weight === '' ? null : Number(weight)
  const weightError = grams !== null && (!Number.isFinite(grams) || grams < 0) ? 'Enter 0 or more' : null
  const preview = grams !== null && !weightError ? unitRemaining({ amount_mode: 'weight', gross_g: grams }, cap) : null

  const commitWeight = () => {
    if (grams === null || weightError || grams === unit.gross_g) return
    const weighed = { amount_mode: 'weight', gross_g: grams }
    patch({ ...weighed, level: unitLevel(weighed, cap) })
  }

  const commitLocation = () => {
    if (location !== unit.location) patch({ location })
  }

  // Closing via Done or the backdrop may not blur the focused input first
  const close = () => {
    commitWeight()
    commitLocation()
    onClose()
  }

  async function toggleArchive() {
    commitWeight()
    commitLocation()
    await patch({ archived: !unit.archived })
    onClose()
  }

  async function remove() {
    if (!confirm(`Delete ${label}?`)) return
    await guard(() => repo.deleteUnit(unit.id))
    onClose()
  }

  return (
    <div class="sheet-backdrop" onClick={e => e.target === e.currentTarget && close()}>
      <div class="sheet" role="dialog" aria-label={label}>
        <header class="bar">
          <h2 style="flex:1;margin:0">{label}</h2>
          <button onClick={close}>Done</button>
        </header>
        <div class="chips" role="group" aria-label="Level">
          {LEVELS.map(l => (
            <button key={l.value} aria-pressed={unit.amount_mode === 'level' && unit.level === l.value}
              onClick={() => { setWeightText(''); patch({ amount_mode: 'level', level: l.value, gross_g: null }) }}>{l.label}</button>
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
          onBlur={commitLocation} />
        <div class="row">
          <button onClick={toggleArchive}>{unit.archived ? 'Unarchive' : 'Archive'}</button>
          <button class="danger" onClick={remove}>Delete</button>
        </div>
      </div>
    </div>
  )
}
