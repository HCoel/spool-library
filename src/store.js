import { createDb } from './core/db.js'
import { createRepo } from './core/repo.js'
import { LIBRARIES } from './libraries/index.js'

export const db = createDb()
export const repo = createRepo(db)

export async function init() {
  try {
    await navigator.storage?.persist?.()
  } catch {
    // persistence is best effort; the backup reminder covers the rest
  }
  for (const lib of LIBRARIES) {
    if (lib.presets) await repo.seedPresets(lib.id, lib.presets)
  }
}
