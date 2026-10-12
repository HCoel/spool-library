const DAY_MS = 86_400_000

export function daysSince(iso, nowMs) {
  if (!iso) return null
  return Math.floor((nowMs - Date.parse(iso)) / DAY_MS)
}

export function needsBackup(lastIso, productCount, nowMs) {
  if (productCount === 0) return false
  const days = daysSince(lastIso, nowMs)
  return days === null || days >= 14
}
