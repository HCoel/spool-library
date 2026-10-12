import { useEffect, useState } from 'preact/hooks'
import { repo } from '../store.js'
import { useLive } from './useLive.js'

export default function PhotoView({ id, alt = '' }) {
  const photo = useLive(() => repo.getPhoto(id), [id], null)
  const [url, setUrl] = useState(null)
  useEffect(() => {
    if (!photo) return undefined
    const u = URL.createObjectURL(new Blob([photo.data], { type: photo.type }))
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [photo])
  return url ? <img class="photo" src={url} alt={alt} /> : null
}
