export default function Filters({ lib, value, onChange }) {
  const set = patch => onChange({ ...value, ...patch })
  const toggle = (key, option) => {
    const current = value.filters[key] ?? []
    const next = current.includes(option) ? current.filter(o => o !== option) : [...current, option]
    set({ filters: { ...value.filters, [key]: next } })
  }
  return (
    <div>
      <input type="search" placeholder="Search..." aria-label="Search" value={value.search}
        onInput={e => set({ search: e.currentTarget.value })} />
      {lib.facets.map(f => (
        <div class="chips" role="group" aria-label={f.label} key={f.key}>
          {f.options.map(o => (
            <button type="button" key={o} aria-pressed={(value.filters[f.key] ?? []).includes(o)} onClick={() => toggle(f.key, o)}>{o}</button>
          ))}
        </div>
      ))}
      <div class="row">
        <select aria-label="Sort" value={value.sort} onChange={e => set({ sort: e.currentTarget.value })}>
          <option value="name">Name</option>
          {(lib.sorts ?? []).map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
          <option value="remaining">Least remaining</option>
        </select>
        <button type="button" aria-pressed={value.showArchived} onClick={() => set({ showArchived: !value.showArchived })}>Show archived</button>
      </div>
    </div>
  )
}
