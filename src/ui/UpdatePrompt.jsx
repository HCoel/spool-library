import { useRegisterSW } from 'virtual:pwa-register/preact'

export default function UpdatePrompt() {
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW()
  if (!needRefresh) return null
  return (
    <div class="toasts">
      <div class="toast">
        <span>Update available</span>
        <button onClick={() => updateServiceWorker(true)}>Reload</button>
      </div>
    </div>
  )
}
