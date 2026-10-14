import { isActive, productRemaining } from './amount.js'

export function groupUnits(units) {
  const map = new Map()
  for (const u of units) {
    if (u.deleted) continue
    if (!map.has(u.product_id)) map.set(u.product_id, [])
    map.get(u.product_id).push(u)
  }
  return map
}

export function matchesSearch(product, search) {
  const q = (search ?? '').trim().toLowerCase()
  if (!q) return true
  return [product.name, product.brand, product.fields?.color_name, product.fields?.category, product.notes]
    .some(v => (v ?? '').toLowerCase().includes(q))
}

export function matchesFilters(product, lib, filters) {
  return lib.facets.every(f => {
    const selected = filters?.[f.key] ?? []
    return selected.length === 0 || selected.includes(f.get(product))
  })
}

const byName = (a, b) => a.product.name.localeCompare(b.product.name)
const COMPARATORS = {
  name: byName,
  remaining: (a, b) => a.remaining - b.remaining || byName(a, b),
}

// Numbers ascending; strings A-Z with blanks last
function compareValues(a, b) {
  if (typeof a === 'number' && typeof b === 'number') return a - b
  if (a === b) return 0
  if (a === '') return 1
  if (b === '') return -1
  return String(a).localeCompare(String(b))
}

function comparatorFor(lib, sort) {
  if (COMPARATORS[sort]) return COMPARATORS[sort]
  const s = lib.sorts?.find(x => x.key === sort)
  if (!s) return byName
  return (a, b) => compareValues(s.get(a.product), s.get(b.product)) || byName(a, b)
}

export function queryProducts(products, unitsByProduct, lib, { search = '', filters = {}, sort = 'name', showArchived = false } = {}) {
  const rows = products
    .filter(p => !p.deleted && matchesSearch(p, search) && matchesFilters(p, lib, filters))
    .map(product => {
      const all = unitsByProduct.get(product.id) ?? []
      const active = all.filter(isActive)
      return {
        product,
        units: showArchived ? all : active,
        activeCount: active.length,
        archivedOnly: active.length === 0 && all.length > 0,
        remaining: productRemaining(all, lib.capOf(product)),
      }
    })
    .filter(r => showArchived || !r.archivedOnly)
  const cmp = comparatorFor(lib, sort)
  return rows.sort((a, b) => (a.activeCount === 0) - (b.activeCount === 0) || cmp(a, b))
}
