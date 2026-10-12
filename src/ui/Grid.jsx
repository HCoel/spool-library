import { useState } from 'preact/hooks'
import { repo } from '../store.js'
import { groupUnits, queryProducts } from '../core/query.js'
import { needsBackup } from '../core/reminder.js'
import { useLive } from './useLive.js'
import Filters from './Filters.jsx'
import ProductCard from './ProductCard.jsx'

export default function Grid({ lib }) {
  const products = useLive(() => repo.listProducts(lib.id), [lib.id], [])
  const units = useLive(() => repo.listAllUnits(), [], [])
  const lastBackup = useLive(() => repo.getMeta('last_backup_at'), [], null)
  const [query, setQuery] = useState({ search: '', filters: {}, sort: 'name', showArchived: false })
  const rows = queryProducts(products, groupUnits(units), lib, query)
  const remind = needsBackup(lastBackup, products.length, Date.now())
  const noun = lib.label.toLowerCase()

  return (
    <>
      <header class="bar">
        <h1>{lib.label}</h1>
        <a class="btn icon-btn" href="#/settings" aria-label="Settings">⚙{remind && <span class="badge" />}</a>
        <a class="btn primary" href="#/new" aria-label={`Add ${noun}`}>＋</a>
      </header>
      <Filters lib={lib} value={query} onChange={setQuery} />
      {products.length === 0
        ? <p class="muted">No {noun} yet. Tap ＋ to add one.</p>
        : rows.length === 0
          ? <p class="muted">Nothing matches.</p>
          : <div class="grid">{rows.map(r => <ProductCard key={r.product.id} lib={lib} row={r} />)}</div>}
    </>
  )
}
