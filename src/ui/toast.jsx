import { useEffect, useState } from 'preact/hooks'

let items = []
let nextId = 1
const listeners = new Set()
const emit = () => listeners.forEach(l => l(items))

export function dismiss(id) {
  items = items.filter(t => t.id !== id)
  emit()
}

export function toast(message, { action, timeout = 4000 } = {}) {
  const id = nextId++
  items = [...items, { id, message, action }]
  emit()
  if (timeout) setTimeout(() => dismiss(id), timeout)
  return id
}

export async function guard(fn, message = "Couldn't save - try again") {
  try {
    return await fn()
  } catch (e) {
    console.error(e)
    toast(message)
    return undefined
  }
}

export function Toasts() {
  const [list, setList] = useState(items)
  useEffect(() => {
    listeners.add(setList)
    return () => listeners.delete(setList)
  }, [])
  return (
    <div class="toasts" role="status">
      {list.map(t => (
        <div class="toast" key={t.id}>
          <span>{t.message}</span>
          {t.action && <button onClick={() => { t.action.run(); dismiss(t.id) }}>{t.action.label}</button>}
        </div>
      ))}
    </div>
  )
}
