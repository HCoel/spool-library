const isSet = v => v !== null && v !== undefined

export function effectiveSettings(keys, preset = {}, overrides = {}) {
  const values = {}
  const overridden = new Set()
  for (const k of keys) {
    const base = preset?.[k] ?? null
    const o = overrides?.[k]
    if (isSet(o) && o !== base) {
      values[k] = o
      overridden.add(k)
    } else {
      values[k] = base
    }
  }
  return { values, overridden }
}

export function diffOverrides(keys, preset = {}, values = {}) {
  const out = {}
  for (const k of keys) {
    const v = values?.[k]
    if (isSet(v) && v !== (preset?.[k] ?? null)) out[k] = v
  }
  return out
}
