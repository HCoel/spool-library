export function parseHash(hash) {
  const parts = (hash ?? '').replace(/^#/, '').split('/').filter(Boolean)
  if (parts[0] === 'p' && parts[1]) return { name: 'product', id: parts[1] }
  if (parts[0] === 'edit' && parts[1]) return { name: 'edit', id: parts[1] }
  if (parts[0] === 'new') return { name: 'new', from: parts[1] ?? null }
  if (parts[0] === 'settings') return { name: 'settings' }
  return { name: 'grid' }
}
