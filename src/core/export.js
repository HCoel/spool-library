export const TABLES = ['products', 'units', 'presets', 'photos']
export const FORMAT_VERSION = 1

export class ImportError extends Error {}

const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/
const isStr = v => typeof v === 'string'
const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v)

// Fields the app reads without guarding; a record missing them would crash the UI after import
const RECORD_CHECKS = {
  products: r => isStr(r.library) && isStr(r.name) && isObj(r.fields) && isStr(r.fields.material),
  units: r => isStr(r.product_id) && ['level', 'weight', 'count'].includes(r.amount_mode) && ISO_RE.test(r.created_at ?? ''),
  presets: r => isStr(r.library) && isStr(r.material),
  photos: r => isStr(r.type),
}

export function bufToBase64(buf) {
  const bytes = new Uint8Array(buf)
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}

export function base64ToBuf(b64) {
  const s = atob(b64)
  const bytes = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i)
  return bytes.buffer
}

export async function buildExport(db, exportedAt) {
  const [products, units, presets, photos] = await Promise.all(TABLES.map(t => db.table(t).toArray()))
  return {
    format_version: FORMAT_VERSION,
    exported_at: exportedAt,
    products,
    units,
    presets,
    photos: photos.map(p => ({ ...p, data: bufToBase64(p.data) })),
  }
}

export function parseImport(text) {
  let data
  try {
    data = JSON.parse(text)
  } catch {
    throw new ImportError('Not a valid backup file (bad JSON)')
  }
  if (data?.format_version !== FORMAT_VERSION) throw new ImportError(`Unsupported backup version: ${data?.format_version}`)
  for (const t of TABLES) {
    if (!Array.isArray(data[t])) throw new ImportError(`Backup is missing "${t}"`)
    data[t].forEach((r, i) => {
      const ok = isObj(r) && isStr(r.id) && ISO_RE.test(r.updated_at ?? '') && RECORD_CHECKS[t](r)
      if (!ok) throw new ImportError(`Bad record in "${t}" (#${i + 1})`)
    })
  }
  const photos = data.photos.map(p => {
    if (typeof p.data !== 'string') throw new ImportError('Bad record in "photos"')
    try {
      return { ...p, data: base64ToBuf(p.data) }
    } catch {
      throw new ImportError('Bad record in "photos"')
    }
  })
  return { ...data, photos }
}

export async function planImport(db, data) {
  const counts = {}
  const writes = {}
  for (const t of TABLES) {
    const incoming = data[t]
    const existing = await db.table(t).bulkGet(incoming.map(r => r.id))
    counts[t] = { new: 0, updated: 0, unchanged: 0 }
    writes[t] = []
    incoming.forEach((rec, i) => {
      const cur = existing[i]
      if (!cur) {
        counts[t].new++
        writes[t].push(rec)
      } else if (rec.updated_at > cur.updated_at) {
        counts[t].updated++
        writes[t].push(rec)
      } else {
        counts[t].unchanged++
      }
    })
  }
  return { counts, writes }
}

export async function applyImport(db, plan) {
  await db.transaction('rw', TABLES.map(t => db.table(t)), async () => {
    for (const t of TABLES) {
      if (plan.writes[t]?.length) await db.table(t).bulkPut(plan.writes[t])
    }
  })
}

export function backupFilename(date = new Date()) {
  return `spool-library-backup-${date.toISOString().slice(0, 10)}.json`
}
