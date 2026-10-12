import { useState } from 'preact/hooks'
import { repo } from '../store.js'
import { getLibrary } from '../libraries/index.js'
import { guard } from './toast.jsx'
import { navigate } from './router.js'
import { useLive } from './useLive.js'
import PhotoView from './PhotoView.jsx'
import UnitRow from './UnitRow.jsx'
import UnitSheet from './UnitSheet.jsx'

export default function ProductDetail({ id }) {
  const product = useLive(() => repo.getProduct(id), [id], null)
  const units = useLive(() => repo.listUnits(id), [id], [])
  const library = product?.library
  const presets = useLive(() => (library ? repo.listPresets(library) : {}), [library], {})
  const [showArchived, setShowArchived] = useState(false)
  const [openUnitId, setOpenUnitId] = useState(null)

  if (product === null) return null
  if (!product) return <><header class="bar"><a class="btn" href="#/">Back</a></header><p>Product not found.</p></>

  const lib = getLibrary(product.library)
  const cap = lib.capOf(product)
  const preset = presets[product.fields[lib.preset_key]] ?? {}
  const numbered = [...units].sort((a, b) => a.created_at.localeCompare(b.created_at)).map((u, i) => ({ u, n: i + 1 }))
  const active = numbered.filter(x => !x.u.archived)
  const archived = numbered.filter(x => x.u.archived)
  const open = numbered.find(x => x.u.id === openUnitId)
  const unitWord = lib.unit_label.toLowerCase()
  const DetailInfo = lib.DetailInfo

  async function remove() {
    if (!confirm(`Delete ${product.name} and all its ${unitWord}s?`)) return
    const ok = await guard(async () => { await repo.deleteProduct(id); return true })
    if (ok) navigate('/')
  }

  const row = ({ u, n }) => <UnitRow key={u.id} lib={lib} cap={cap} unit={u} n={n} onOpen={() => setOpenUnitId(u.id)} />

  return (
    <>
      <header class="bar">
        <a class="btn" href="#/">Back</a>
        <h1>{product.name}</h1>
      </header>
      <div class="row" style="align-items:center">
        <div style="flex:0 0 auto"><lib.Visual product={product} size={96} /></div>
        {product.photo_id && <PhotoView id={product.photo_id} alt={product.name} />}
      </div>
      <DetailInfo product={product} preset={preset} />
      {product.notes && <p>{product.notes}</p>}
      <h2>{lib.unit_label}s ({active.length})</h2>
      {active.map(row)}
      <button onClick={() => guard(() => repo.addUnit(id))}>＋ Add {unitWord}</button>
      {archived.length > 0 && (
        <div class="row">
          <button aria-pressed={showArchived} onClick={() => setShowArchived(!showArchived)}>Show archived ({archived.length})</button>
        </div>
      )}
      {showArchived && archived.map(row)}
      <div class="row">
        <a class="btn" href={`#/edit/${id}`}>Edit</a>
        <a class="btn" href={`#/new/${id}`}>Duplicate</a>
        <button class="danger" onClick={remove}>Delete</button>
      </div>
      {open && <UnitSheet key={open.u.id} lib={lib} cap={cap} unit={open.u} n={open.n} onClose={() => setOpenUnitId(null)} />}
    </>
  )
}
