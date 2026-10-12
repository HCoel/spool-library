import Dexie from 'dexie'

export function createDb(name = 'spool-library') {
  const db = new Dexie(name)
  db.version(1).stores({
    products: 'id, library, updated_at',
    units: 'id, product_id, updated_at',
    presets: 'id, library',
    photos: 'id',
    meta: 'key',
  })
  return db
}
