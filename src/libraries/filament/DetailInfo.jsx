import { effectiveSettings } from '../../core/presets.js'
import { formatGrams } from '../../core/amount.js'
import { SETTING_KEYS, formatRange, presetKeyOf, typeLabel } from './definition.js'

export default function DetailInfo({ product, preset }) {
  const f = product.fields
  const { values: v, overridden } = effectiveSettings(SETTING_KEYS, preset, f.overrides)
  const star = (...keys) => (keys.some(k => overridden.has(k)) ? ' ★' : '')
  const dry = v.dry_temp != null ? `${v.dry_temp} °C${v.dry_hours != null ? ` · ${v.dry_hours} h` : ''}` : null
  const rows = [
    ['Nozzle', formatRange(v.nozzle_min, v.nozzle_max, '°C'), star('nozzle_min', 'nozzle_max')],
    ['Bed', formatRange(v.bed_min, v.bed_max, '°C'), star('bed_min', 'bed_max')],
    ['Dry', dry, star('dry_temp', 'dry_hours')],
    ['Max speed', v.speed_max != null ? `${v.speed_max} mm/s` : null, star('speed_max')],
  ].filter(r => r[1])

  return (
    <>
      <p>
        {f.color_name && <strong>{f.color_name} · </strong>}
        {f.finish} · {typeLabel(f)} · {f.diameter} mm · {formatGrams(f.net_g)} spool
      </p>
      {rows.length > 0
        ? <table class="settings-table"><tbody>{rows.map(([k, val, s]) => <tr key={k}><td class="muted">{k}</td><td>{val}{s}</td></tr>)}</tbody></table>
        : <p class="muted">No print settings. Edit this product or the {presetKeyOf(f)} preset.</p>}
      {overridden.size > 0 && <p class="muted">★ differs from the {presetKeyOf(f)} preset</p>}
    </>
  )
}
