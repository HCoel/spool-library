import { Component } from 'preact'
import { exportBackup } from './backupActions.js'

export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error) {
    console.error(error)
  }

  render({ children }, { error }) {
    if (!error) return children
    return (
      <div class="fatal">
        <h1>Something broke</h1>
        <p class="muted">{String(error?.message ?? error)}</p>
        <p>Your data is still on this phone. Export a backup to be safe, then reload.</p>
        <div class="row">
          <button class="primary" onClick={() => exportBackup()}>Export backup</button>
          <button onClick={() => location.reload()}>Reload</button>
        </div>
      </div>
    )
  }
}
