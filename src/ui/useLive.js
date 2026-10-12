import { useEffect, useState } from 'preact/hooks'
import { liveQuery } from 'dexie'

export function useLive(query, deps, initial) {
  const [value, setValue] = useState(initial)
  useEffect(() => {
    const sub = liveQuery(query).subscribe({ next: setValue, error: e => console.error(e) })
    return () => sub.unsubscribe()
  }, deps)
  return value
}
