export const TABLES = ['products', 'units', 'presets', 'photos']
export const FORMAT_VERSION = 1

export class ImportError extends Error {}

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
    for (const r of data[t]) {
      if (typeof r?.id !== 'string' || typeof r?.updated_at !== 'string') throw new ImportError(`Bad record in "${t}"`)
    }
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
