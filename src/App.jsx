import { useState } from 'preact/hooks'
import { LIBRARIES, getLibrary } from './libraries/index.js'
import { useRoute } from './ui/router.js'
import { Toasts } from './ui/toast.jsx'
import InstallGate from './ui/InstallGate.jsx'
import UpdatePrompt from './ui/UpdatePrompt.jsx'
import Grid from './ui/Grid.jsx'
import ProductForm from './ui/ProductForm.jsx'
import ProductDetail from './ui/ProductDetail.jsx'
import Settings from './ui/Settings.jsx'

export default function App() {
  const route = useRoute()
  const [libId, setLibId] = useState(LIBRARIES[0].id)
  const lib = getLibrary(libId)

  let page
  switch (route.name) {
    case 'new':
      page = <ProductForm key={`new-${route.from ?? ''}`} lib={lib} duplicateFrom={route.from} />
      break
    case 'edit':
      page = <ProductForm key={`edit-${route.id}`} lib={lib} editId={route.id} />
      break
    case 'product':
      page = <ProductDetail key={route.id} id={route.id} />
      break
    case 'settings':
      page = <Settings lib={lib} />
      break
    default:
      page = <Grid lib={lib} />
  }

  return (
    <InstallGate>
      {page}
      <nav class="tabs">
        {LIBRARIES.map(l => (
          <a key={l.id} href="#/" aria-current={l.id === libId ? 'page' : undefined} onClick={() => setLibId(l.id)}>{l.label}</a>
        ))}
      </nav>
      <UpdatePrompt />
      <Toasts />
    </InstallGate>
  )
}
