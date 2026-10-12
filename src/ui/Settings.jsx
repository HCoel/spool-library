import { useEffect, useState } from 'preact/hooks'
import { db, repo } from '../store.js'
import { ImportError, TABLES, applyImport, parseImport, planImport } from '../core/export.js'
import { daysSince, needsBackup } from '../core/reminder.js'
import { exportBackup } from './backupActions.js'
import { guard, toast } from './toast.jsx'
import { useLive } from './useLive.js'

const num = v => (v === '' || v == null ? null : Number(v))

function ImportPreview({ plan, onApply, onCancel }) {
  const changes = TABLES.reduce((sum, t) => sum + plan.counts[t].new + plan.counts[t].updated, 0)
  return (
    <div class="sheet-backdrop">
      <div class="sheet" role="dialog" aria-label="Import preview">
        <h2>Import preview</h2>
        <table class="preview">
          <thead><tr><th /><th>New</th><th>Updated</th><th>Unchanged</th></tr></thead>
          <tbody>
            {TABLES.map(t => (
              <tr key={t}><td>{t}</td><td>{plan.counts[t].new}</td><td>{plan.counts[t].updated}</td><td>{plan.counts[t].unchanged}</td></tr>
            ))}
          </tbody>
        </table>
        <p class="muted">Records only replace yours when the backup copy is newer.</p>
        <div class="row">
          <button onClick={onCancel}>Cancel</button>
          <button class="primary" disabled={changes === 0} onClick={onApply}>{changes === 0 ? 'Nothing to import' : 'Apply'}</button>
        </div>
      </div>
    </div>
  )
}

function PresetEditor({ lib, material, preset, open, onToggle }) {
  const [draft, setDraft] = useState(null)
  useEffect(() => {
    if (open) setDraft(Object.fromEntries(lib.SETTING_KEYS.map(k => [k, preset[k] ?? null])))
  }, [open])

  if (!open || !draft) {
    return (
      <button class="unit-row" onClick={onToggle}>
        <strong>{material}</strong>
        <span class="muted">{lib.formatPresetLine(preset)}</span>
      </button>
    )
  }

  const errors = lib.validateSettings(draft)
  const valid = Object.keys(errors).length === 0
  async function save() {
    const ok = await guard(async () => { await repo.savePreset(lib.id, material, draft); return true })
    if (ok) onToggle()
  }

  return (
    <div class="sheet" style="position:static;border-radius:12px;border:1px solid var(--border);margin:6px 0">
      <strong>{material}</strong>
      {lib.SETTING_KEYS.map(k => (
        <div key={k}>
          <label for={`preset-${k}`}>{lib.SETTING_LABELS[k]}</label>
          <input id={`preset-${k}`} type="number" inputmode="numeric" value={draft[k] ?? ''}
            onInput={e => setDraft({ ...draft, [k]: num(e.currentTarget.value) })} />
          {errors[k] && <div class="error">{errors[k]}</div>}
        </div>
      ))}
      <div class="row">
        <button onClick={onToggle}>Cancel</button>
        <button class="primary" disabled={!valid} onClick={save}>Save preset</button>
      </div>
    </div>
  )
}

export default function Settings({ lib }) {
  const presets = useLive(() => repo.listPresets(lib.id), [lib.id], {})
  const products = useLive(() => repo.listProducts(lib.id), [lib.id], [])
  const lastBackup = useLive(() => repo.getMeta('last_backup_at'), [], null)
  const [plan, setPlan] = useState(null)
  const [openMaterial, setOpenMaterial] = useState(null)
  const days = daysSince(lastBackup, Date.now())
  const overdue = needsBackup(lastBackup, products.length, Date.now())

  async function onImportFile(e) {
    const input = e.currentTarget
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    try {
      setPlan(await planImport(db, parseImport(await file.text())))
    } catch (err) {
      toast(err instanceof ImportError ? err.message : "Couldn't read that file")
    }
  }

  async function apply() {
    const ok = await guard(async () => { await applyImport(db, plan); return true }, 'Import failed - nothing was changed')
    if (ok) {
      toast('Backup imported')
      setPlan(null)
    }
  }

  return (
    <>
      <header class="bar">
        <a class="btn" href="#/">Back</a>
        <h1>Settings</h1>
      </header>

      <h2>Backup</h2>
      <p class={overdue ? 'error' : 'muted'}>
        {days === null ? 'Never backed up' : `Last backup: ${days} day${days === 1 ? '' : 's'} ago`}
      </p>
      <p class="muted">
        Your data lives only on this phone. Removing Spool Library from your home screen deletes it.
        Export regularly and save the file to iCloud Drive.
      </p>
      <div class="row">
        <button class="primary" onClick={() => guard(exportBackup, "Couldn't export - try again")}>Export backup</button>
        <label class="btn" style="margin:0;color:var(--text);font-size:16px">
          Import backup
          <input type="file" accept="application/json,.json" hidden onChange={onImportFile} />
        </label>
      </div>
      {plan && <ImportPreview plan={plan} onApply={apply} onCancel={() => setPlan(null)} />}

      <h2>{lib.label} presets</h2>
      <p class="muted">Used to fill print settings for new and existing products. A product's own values override these.</p>
      {Object.keys(lib.presets).map(m => (
        <PresetEditor key={m} lib={lib} material={m} preset={presets[m] ?? {}} open={openMaterial === m}
          onToggle={() => setOpenMaterial(openMaterial === m ? null : m)} />
      ))}
    </>
  )
}
