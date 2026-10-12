import { backupFilename, buildExport } from '../core/export.js'
import { db, repo } from '../store.js'

export async function exportBackup() {
  const now = new Date()
  const data = await buildExport(db, now.toISOString())
  const file = new File([JSON.stringify(data)], backupFilename(now), { type: 'application/json' })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Spool Library backup' })
      await repo.setMeta('last_backup_at', now.toISOString())
      return true
    } catch (e) {
      if (e.name === 'AbortError') return false
      // any other share failure: fall through to a plain download
    }
  }
  const url = URL.createObjectURL(file)
  const a = Object.assign(document.createElement('a'), { href: url, download: file.name })
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
  await repo.setMeta('last_backup_at', now.toISOString())
  return true
}
