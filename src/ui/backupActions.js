import { backupFilename, buildExport } from '../core/export.js'
import { deliverFile } from '../core/share.js'
import { db, repo } from '../store.js'
import { toast } from './toast.jsx'

function download(file) {
  const url = URL.createObjectURL(file)
  const a = Object.assign(document.createElement('a'), { href: url, download: file.name })
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

async function deliver(file, exportedAt) {
  const result = await deliverFile(file, { download })
  if (result === 'shared' || result === 'downloaded') {
    await repo.setMeta('last_backup_at', exportedAt)
    return true
  }
  if (result === 'blocked') {
    // The retry tap counts as a fresh user gesture, which Safari requires for share()
    toast('Backup ready', { action: { label: 'Share now', run: () => deliver(file, exportedAt) }, timeout: 0 })
  }
  return false
}

export async function exportBackup() {
  const now = new Date()
  const data = await buildExport(db, now.toISOString())
  const file = new File([JSON.stringify(data)], backupFilename(now), { type: 'application/json' })
  return deliver(file, now.toISOString())
}
