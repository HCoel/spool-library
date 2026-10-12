import { useEffect, useState } from 'preact/hooks'
import { parseHash } from '../core/route.js'

export function navigate(path) {
  location.hash = path
}

export function useRoute() {
  const [route, setRoute] = useState(() => parseHash(location.hash))
  useEffect(() => {
    const onChange = () => setRoute(parseHash(location.hash))
    addEventListener('hashchange', onChange)
    return () => removeEventListener('hashchange', onChange)
  }, [])
  return route
}
