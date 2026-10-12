import { render } from 'preact'
import App from './App.jsx'
import ErrorBoundary from './ui/ErrorBoundary.jsx'
import { init } from './store.js'
import './styles.css'

init().finally(() => {
  render(<ErrorBoundary><App /></ErrorBoundary>, document.getElementById('app'))
})
