import { useState } from 'preact/hooks'

const KEY = 'install-gate-dismissed'

export function isStandalone() {
  return navigator.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches === true
}

function wasDismissed() {
  try {
    return sessionStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

export default function InstallGate({ children }) {
  const [open, setOpen] = useState(() => !isStandalone() && !wasDismissed())
  if (!open) return children
  const dismiss = () => {
    try {
      sessionStorage.setItem(KEY, '1')
    } catch {
      // private mode: dismiss for this render only
    }
    setOpen(false)
  }
  return (
    <div class="gate">
      <h1>Add to Home Screen</h1>
      <p>Spool Library keeps your data on this phone. Safari tabs and home-screen apps store data separately, so install it first:</p>
      <ol>
        <li>Tap the Share button (square with an arrow).</li>
        <li>Choose <b>Add to Home Screen</b>.</li>
        <li>Open Spool Library from your home screen.</li>
      </ol>
      <button onClick={dismiss}>Use in browser anyway</button>
    </div>
  )
}
