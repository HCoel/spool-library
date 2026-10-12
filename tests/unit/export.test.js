import { beforeEach, describe, expect, test } from 'vitest'
import { createDb } from '../../src/core/db.js'
import { createRepo } from '../../src/core/repo.js'
import {
  ImportError, applyImport, backupFilename, base64ToBuf, bufToBase64, buildExport, parseImport, planImport,
} from '../../src/core/export.js'

let n = 0
const freshRepo = () => {
  let t = 0
  return createRepo(createDb(`test-${crypto.randomUUID()}`), {
    now: () => new Date(Date.UTC(2026, 0, 1) + (t++) * 1000).toISOString(),
    uuid: () => `id-${++n}`,
  })
}
const base = { library: 'filament', name: 'Black PLA', fields: { material: 'PLA', net_g: 1000, empty_spool_g: 250 } }

async function populated() {
  const repo = freshRepo()
  const photoId = await repo.savePhoto({ type: 'image/jpeg', data: new Uint8Array([1, 2, 3, 250]).buffer })
  const p = await repo.createProduct({ ...base, photo_id: photoId })
  await repo.addUnit(p.id)
  const gone = await repo.createProduct(base)
  await repo.deleteProduct(gone.id)
  await repo.seedPresets('filament', { PLA: { nozzle_min: 190 } })
  return repo
}

const snapshot = async db => {
  const out = {}
  for (const t of ['products', 'units', 'presets', 'photos']) {
    out[t] = (await db.table(t).toArray())
      .map(r => (r.data ? { ...r, data: [...new Uint8Array(r.data)] } : r))
      .sort((a, b) => a.id.localeCompare(b.id))
  }
  return out
}

describe('base64', () => {
  test('round trips bytes', () => {
    const buf = new Uint8Array([0, 1, 127, 128, 255]).buffer
    expect([...new Uint8Array(base64ToBuf(bufToBase64(buf)))]).toEqual([0, 1, 127, 128, 255])
  })
})

describe('export and import', () => {
  let source
  beforeEach(async () => { source = await populated() })

  test('round trip into an empty database reproduces every record, tombstones included', async () => {
    const text = JSON.stringify(await buildExport(source.db, '2026-02-01T00:00:00.000Z'))
    const target = freshRepo()
    const plan = await planImport(target.db, parseImport(text))
    expect(plan.counts.products).toEqual({ new: 2, updated: 0, unchanged: 0 })
    await applyImport(target.db, plan)
    expect(await snapshot(target.db)).toEqual(await snapshot(source.db))
  })

  test('merge: newer incoming wins, older and equal are ignored, tombstones apply', async () => {
    const target = freshRepo()
    await applyImport(target.db, await planImport(target.db, parseImport(JSON.stringify(await buildExport(source.db, 'x')))))
    const [live] = await source.listProducts('filament')
    const data = parseImport(JSON.stringify(await buildExport(source.db, 'x')))
    const newer = { ...live, name: 'Newer', updated_at: '2027-01-01T00:00:00.000Z' }
    const older = { ...live, name: 'Older', updated_at: '2020-01-01T00:00:00.000Z' }

    let plan = await planImport(target.db, { ...data, products: [newer] })
    expect(plan.counts.products).toEqual({ new: 0, updated: 1, unchanged: 0 })
    await applyImport(target.db, plan)
    expect((await target.db.products.get(live.id)).name).toBe('Newer')

    plan = await planImport(target.db, { ...data, products: [older] })
    expect(plan.counts.products).toEqual({ new: 0, updated: 0, unchanged: 1 })

    const tomb = { ...newer, deleted: true, updated_at: '2028-01-01T00:00:00.000Z' }
    await applyImport(target.db, await planImport(target.db, { ...data, products: [tomb] }))
    expect((await target.db.products.get(live.id)).deleted).toBe(true)
  })
})

// Review focus 3: bad files are rejected, partial failures roll back
describe('rejecting bad backups', () => {
  test.each([
    ['not json', /bad JSON/],
    [JSON.stringify({ format_version: 2, products: [], units: [], presets: [], photos: [] }), /Unsupported backup version: 2/],
    [JSON.stringify({ format_version: 1, products: [], units: [], presets: [] }), /missing "photos"/],
    [JSON.stringify({ format_version: 1, products: [{ name: 'x' }], units: [], presets: [], photos: [] }), /Bad record in "products"/],
    [JSON.stringify({ format_version: 1, products: [], units: [], presets: [], photos: [{ id: 'p', updated_at: 'x', data: 42 }] }), /Bad record in "photos"/],
  ])('%s', (text, message) => {
    expect(() => parseImport(text)).toThrow(ImportError)
    expect(() => parseImport(text)).toThrow(message)
  })

  test('a failure mid-write leaves the database untouched', async () => {
    const target = freshRepo()
    const plan = {
      counts: {},
      writes: {
        products: [{ id: 'ok', library: 'filament', updated_at: 'x', fields: {} }],
        units: [{ updated_at: 'x' }], // no primary key: bulkPut throws
        presets: [],
        photos: [],
      },
    }
    await expect(applyImport(target.db, plan)).rejects.toThrow()
    expect(await target.db.products.count()).toBe(0)
  })
})

test('backupFilename uses the date', () => {
  expect(backupFilename(new Date('2026-10-12T05:00:00Z'))).toBe('spool-library-backup-2026-10-12.json')
})
