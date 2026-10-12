import { beforeEach, describe, expect, test } from 'vitest'
import { createDb } from '../../src/core/db.js'
import { createRepo } from '../../src/core/repo.js'

let repo
let db

function clock() {
  let t = 0
  return () => new Date(Date.UTC(2026, 0, 1) + (t++) * 1000).toISOString()
}

beforeEach(() => {
  db = createDb(`test-${crypto.randomUUID()}`)
  let n = 0
  repo = createRepo(db, { now: clock(), uuid: () => `id-${++n}` })
})

const base = { library: 'filament', name: 'Black PLA', brand: 'Bambu', fields: { material: 'PLA', net_g: 1000, empty_spool_g: 250 } }

describe('products', () => {
  test('createProduct adds the product and one full spool', async () => {
    const p = await repo.createProduct(base)
    expect(p).toMatchObject({ id: 'id-1', deleted: false, created_at: p.updated_at })
    const units = await repo.listUnits(p.id)
    expect(units).toHaveLength(1)
    expect(units[0]).toMatchObject({ product_id: p.id, amount_mode: 'level', level: 1, archived: false, deleted: false })
  })

  test('saveProduct keeps created_at and bumps updated_at', async () => {
    const p = await repo.saveProduct(base)
    const updated = await repo.saveProduct({ ...p, name: 'Renamed' })
    expect(updated.created_at).toBe(p.created_at)
    expect(updated.updated_at > p.updated_at).toBe(true)
    expect((await repo.getProduct(p.id)).name).toBe('Renamed')
  })

  test('listProducts filters by library and hides tombstones', async () => {
    const a = await repo.createProduct(base)
    await repo.createProduct({ ...base, library: 'electronics' })
    const c = await repo.createProduct(base)
    await repo.deleteProduct(c.id)
    expect((await repo.listProducts('filament')).map(p => p.id)).toEqual([a.id])
  })

  test('deleteProduct tombstones product, units and photo', async () => {
    const photoId = await repo.savePhoto({ type: 'image/jpeg', data: new Uint8Array([1, 2]).buffer })
    const p = await repo.createProduct({ ...base, photo_id: photoId })
    await repo.deleteProduct(p.id)
    expect(await repo.getProduct(p.id)).toBeUndefined()
    expect(await repo.listUnits(p.id)).toEqual([])
    expect(await repo.getPhoto(photoId)).toBeUndefined()
    expect((await db.products.get(p.id)).deleted).toBe(true)
    expect((await db.units.where('product_id').equals(p.id).toArray()).every(u => u.deleted)).toBe(true)
  })
})

describe('units', () => {
  test('addUnit, archive and delete', async () => {
    const p = await repo.createProduct(base)
    const u2 = await repo.addUnit(p.id)
    await repo.saveUnit({ ...u2, archived: true })
    expect((await repo.listUnits(p.id)).map(u => u.archived)).toEqual([false, true])
    await repo.deleteUnit(u2.id)
    expect(await repo.listUnits(p.id)).toHaveLength(1)
    expect(await repo.listAllUnits()).toHaveLength(1)
  })
})

test('updateUnit merges a patch without clobbering other fields', async () => {
  const p = await repo.createProduct(base)
  const [u] = await repo.listUnits(p.id)
  await repo.updateUnit(u.id, { location: 'Box A' })
  await repo.updateUnit(u.id, { amount_mode: 'level', level: 0.5, gross_g: null })
  const [after] = await repo.listUnits(p.id)
  expect(after).toMatchObject({ location: 'Box A', amount_mode: 'level', level: 0.5, product_id: p.id })
  expect(after.updated_at > u.updated_at).toBe(true)
})

describe('presets', () => {
  test('seedPresets adds missing materials without overwriting edits', async () => {
    await repo.seedPresets('filament', { PLA: { nozzle_min: 190 }, PETG: { nozzle_min: 230 } })
    await repo.savePreset('filament', 'PLA', { nozzle_min: 200 })
    await repo.seedPresets('filament', { PLA: { nozzle_min: 190 }, PETG: { nozzle_min: 230 }, TPU: { nozzle_min: 210 } })
    const presets = await repo.listPresets('filament')
    expect(presets.PLA.nozzle_min).toBe(200)
    expect(presets.PETG.nozzle_min).toBe(230)
    expect(presets.TPU.nozzle_min).toBe(210)
    expect(presets.PLA.updated_at).toBeTypeOf('string')
  })
})

describe('photos and meta', () => {
  test('photo round trip keeps bytes', async () => {
    const id = await repo.savePhoto({ type: 'image/jpeg', data: new Uint8Array([9, 8, 7]).buffer })
    const photo = await repo.getPhoto(id)
    expect(photo.type).toBe('image/jpeg')
    expect([...new Uint8Array(photo.data)]).toEqual([9, 8, 7])
  })
  test('meta get and set', async () => {
    expect(await repo.getMeta('last_backup_at')).toBeNull()
    await repo.setMeta('last_backup_at', '2026-01-01T00:00:00.000Z')
    expect(await repo.getMeta('last_backup_at')).toBe('2026-01-01T00:00:00.000Z')
  })
})
