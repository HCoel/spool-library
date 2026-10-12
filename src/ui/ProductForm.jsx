import { useEffect, useState } from 'preact/hooks'
import { repo } from '../store.js'
import { getLibrary } from '../libraries/index.js'
import { diffOverrides } from '../core/presets.js'
import { resizeImage } from '../core/image.js'
import { guard } from './toast.jsx'
import { navigate } from './router.js'
import { useLive } from './useLive.js'
import PhotoView from './PhotoView.jsx'

function blankState(lib) {
  return { libId: lib.id, name: '', brand: '', notes: '', photo_id: null, original_photo_id: null, fields: lib.newFields(), overrides: {} }
}

function fromProduct(p, isEdit) {
  const { overrides = {}, ...fields } = p.fields
  return {
    libId: p.library,
    name: isEdit ? p.name : '',
    brand: p.brand ?? '',
    notes: p.notes ?? '',
    photo_id: isEdit ? p.photo_id ?? null : null,
    original_photo_id: isEdit ? p.photo_id ?? null : null,
    fields,
    overrides: { ...overrides },
  }
}

function buildProduct(lib, s, preset, id) {
  const p = {
    library: lib.id,
    brand: s.brand.trim(),
    notes: s.notes,
    photo_id: s.photo_id,
    fields: { ...s.fields, overrides: diffOverrides(lib.SETTING_KEYS, preset, s.overrides) },
  }
  if (id) p.id = id
  return { ...p, name: s.name.trim() || lib.defaultName(p) }
}

export default function ProductForm({ lib: defaultLib, editId, duplicateFrom }) {
  const sourceId = editId ?? duplicateFrom
  const [state, setState] = useState(sourceId ? null : blankState(defaultLib))
  const [missing, setMissing] = useState(false)
  const libId = state?.libId ?? defaultLib.id
  const presets = useLive(() => repo.listPresets(libId), [libId], {})

  useEffect(() => {
    if (!sourceId) {
      setState(blankState(defaultLib))
      return
    }
    repo.getProduct(sourceId).then(p => (p ? setState(fromProduct(p, Boolean(editId))) : setMissing(true)))
  }, [sourceId])

  if (missing) return <><header class="bar"><a class="btn" href="#/">Back</a></header><p>Product not found.</p></>
  if (!state) return null

  const lib = getLibrary(state.libId)
  const preset = presets[state.fields[lib.preset_key]] ?? {}
  const candidate = buildProduct(lib, state, preset, editId)
  const errors = lib.validate(candidate, preset)
  const valid = Object.keys(errors).length === 0
  const update = patch => setState(s => ({ ...s, ...patch }))
  const FormFields = lib.FormFields

  async function onPhoto(e) {
    const file = e.currentTarget.files?.[0]
    if (!file) return
    const id = await guard(async () => repo.savePhoto(await resizeImage(file)), "Couldn't read that photo")
    if (id) update({ photo_id: id })
  }

  async function save(e) {
    e.preventDefault()
    if (!valid) return
    const saved = await guard(async () => {
      const result = editId ? await repo.saveProduct(candidate) : await repo.createProduct(candidate)
      if (state.original_photo_id && state.original_photo_id !== state.photo_id) await repo.deletePhoto(state.original_photo_id)
      return result
    })
    if (saved) navigate(`/p/${saved.id}`)
  }

  const title = editId ? 'Edit' : duplicateFrom ? 'Duplicate' : `New ${lib.label.toLowerCase()}`

  return (
    <form onSubmit={save}>
      <header class="bar">
        <a class="btn" href={editId ? `#/p/${editId}` : '#/'}>Cancel</a>
        <h1>{title}</h1>
        <button class="primary" type="submit" disabled={!valid}>Save</button>
      </header>
      <div style="display:flex;justify-content:center">
        <lib.Visual product={{ ...candidate, id: editId ?? 'preview' }} size={120} />
      </div>
      <label for="brand">Brand</label>
      <input id="brand" value={state.brand} onInput={e => update({ brand: e.currentTarget.value })} />
      <FormFields
        fields={state.fields}
        overrides={state.overrides}
        preset={preset}
        errors={errors}
        onFields={p => setState(s => ({ ...s, fields: { ...s.fields, ...p } }))}
        onOverrides={p => setState(s => ({ ...s, overrides: { ...s.overrides, ...p } }))}
      />
      <label for="name">Name</label>
      <input id="name" value={state.name} placeholder={lib.defaultName(candidate)} onInput={e => update({ name: e.currentTarget.value })} />
      <label for="photo">Photo (optional)</label>
      {state.photo_id
        ? <><PhotoView id={state.photo_id} /><button type="button" onClick={() => update({ photo_id: null })}>Remove photo</button></>
        : <input id="photo" type="file" accept="image/*" onChange={onPhoto} />}
      <label for="notes">Notes</label>
      <textarea id="notes" rows="3" value={state.notes} onInput={e => update({ notes: e.currentTarget.value })} />
    </form>
  )
}
