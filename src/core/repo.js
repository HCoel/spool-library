const live = rows => rows.filter(r => r && !r.deleted)

export function createRepo(db, { now = () => new Date().toISOString(), uuid = () => crypto.randomUUID() } = {}) {
  async function listProducts(library) {
    return live(await db.products.where('library').equals(library).toArray())
  }

  async function getProduct(id) {
    const p = await db.products.get(id)
    return p && !p.deleted ? p : undefined
  }

  async function saveProduct(product) {
    const t = now()
    const existing = product.id ? await db.products.get(product.id) : undefined
    const rec = {
      deleted: false,
      ...existing,
      ...product,
      id: product.id ?? uuid(),
      created_at: existing?.created_at ?? t,
      updated_at: t,
    }
    await db.products.put(rec)
    return rec
  }

  function newUnit(productId) {
    const t = now()
    return {
      id: uuid(), product_id: productId, amount_mode: 'level', level: 1, gross_g: null, count: null,
      location: '', archived: false, created_at: t, updated_at: t, deleted: false,
    }
  }

  async function createProduct(product) {
    return db.transaction('rw', db.products, db.units, async () => {
      const p = await saveProduct(product)
      await db.units.put(newUnit(p.id))
      return p
    })
  }

  async function deleteProduct(id) {
    await db.transaction('rw', db.products, db.units, db.photos, async () => {
      const t = now()
      const p = await db.products.get(id)
      if (!p) return
      await db.products.update(id, { deleted: true, updated_at: t })
      const units = await db.units.where('product_id').equals(id).toArray()
      await Promise.all(units.map(u => db.units.update(u.id, { deleted: true, updated_at: t })))
      if (p.photo_id) await db.photos.update(p.photo_id, { deleted: true, updated_at: t })
    })
  }

  async function listUnits(productId) {
    return live(await db.units.where('product_id').equals(productId).toArray())
  }

  async function listAllUnits() {
    return live(await db.units.toArray())
  }

  async function addUnit(productId) {
    const u = newUnit(productId)
    await db.units.put(u)
    return u
  }

  async function saveUnit(unit) {
    const rec = { ...unit, updated_at: now() }
    await db.units.put(rec)
    return rec
  }

  async function deleteUnit(id) {
    await db.units.update(id, { deleted: true, updated_at: now() })
  }

  async function seedPresets(library, presets) {
    const ids = Object.keys(presets).map(m => `${library}:${m}`)
    const existing = await db.presets.bulkGet(ids)
    const t = now()
    const missing = Object.entries(presets)
      .filter((_, i) => !existing[i])
      .map(([material, settings]) => ({ ...settings, id: `${library}:${material}`, library, material, updated_at: t }))
    if (missing.length) await db.presets.bulkPut(missing)
  }

  async function listPresets(library) {
    const rows = await db.presets.where('library').equals(library).toArray()
    return Object.fromEntries(rows.map(r => [r.material, r]))
  }

  async function savePreset(library, material, settings) {
    await db.presets.put({ ...settings, id: `${library}:${material}`, library, material, updated_at: now() })
  }

  async function savePhoto({ type, data }) {
    const id = uuid()
    await db.photos.put({ id, type, data, updated_at: now(), deleted: false })
    return id
  }

  async function getPhoto(id) {
    const p = await db.photos.get(id)
    return p && !p.deleted ? p : undefined
  }

  async function deletePhoto(id) {
    await db.photos.update(id, { deleted: true, updated_at: now() })
  }

  async function getMeta(key) {
    return (await db.meta.get(key))?.value ?? null
  }

  async function setMeta(key, value) {
    await db.meta.put({ key, value })
  }

  return {
    db, listProducts, getProduct, saveProduct, createProduct, deleteProduct,
    listUnits, listAllUnits, addUnit, saveUnit, deleteUnit,
    seedPresets, listPresets, savePreset, savePhoto, getPhoto, deletePhoto, getMeta, setMeta,
  }
}
