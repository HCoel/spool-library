import { isHex } from '../../core/color.js'
import { FINISHES, MATERIALS, SETTING_LABELS } from './definition.js'

const num = v => (v === '' || v == null ? null : Number(v))

function ColorField({ id, label, value, onChange, error }) {
  return (
    <div>
      <label for={id}>{label}</label>
      <div class="row" style="align-items:center;margin:0">
        <input type="color" aria-label={`${label} picker`} value={isHex(value) ? value : '#888888'}
          onInput={e => onChange(e.currentTarget.value)} style="flex:0 0 52px;height:40px;padding:2px" />
        <input id={id} value={value ?? ''} placeholder="#RRGGBB" autocapitalize="off" autocomplete="off"
          onInput={e => onChange(e.currentTarget.value || null)} />
      </div>
      {error && <div class="error">{error}</div>}
    </div>
  )
}

export default function FormFields({ fields, overrides, preset, errors, onFields, onOverrides }) {
  const f = fields
  const text = key => e => onFields({ [key]: e.currentTarget.value })
  const number = key => e => onFields({ [key]: num(e.currentTarget.value) })
  const err = key => errors[key] && <div class="error">{errors[key]}</div>
  const setting = key => (
    <div>
      <label for={key}>{SETTING_LABELS[key]}</label>
      <input id={key} type="number" inputmode="numeric" placeholder={preset[key] ?? '-'} value={overrides[key] ?? ''}
        onInput={e => onOverrides({ [key]: num(e.currentTarget.value) })} />
      {err(key)}
    </div>
  )

  return (
    <>
      <div class="row">
        <div>
          <label for="material">Material</label>
          <select id="material" value={f.material} onChange={text('material')}>
            {MATERIALS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          {err('material')}
        </div>
        <div>
          <label for="finish">Finish</label>
          <select id="finish" value={f.finish} onChange={text('finish')}>
            {FINISHES.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          {err('finish')}
        </div>
      </div>
      <label for="color_name">Colour name</label>
      <input id="color_name" value={f.color_name} onInput={text('color_name')} />
      <ColorField id="color_hex" label="Hex" value={f.color_hex} error={errors.color_hex} onChange={v => onFields({ color_hex: v })} />
      {f.finish === 'multi' && (
        <>
          <ColorField id="color_hex_2" label="Hex 2" value={f.color_hex_2} error={errors.color_hex_2} onChange={v => onFields({ color_hex_2: v })} />
          <ColorField id="color_hex_3" label="Hex 3 (optional)" value={f.color_hex_3} error={errors.color_hex_3} onChange={v => onFields({ color_hex_3: v })} />
        </>
      )}
      <div class="row">
        <div>
          <label for="diameter">Diameter (mm)</label>
          <input id="diameter" type="number" step="0.01" value={f.diameter ?? ''} onInput={number('diameter')} />
          {err('diameter')}
        </div>
        <div>
          <label for="net_g">Net (g)</label>
          <input id="net_g" type="number" inputmode="numeric" value={f.net_g ?? ''} onInput={number('net_g')} />
          {err('net_g')}
        </div>
        <div>
          <label for="empty_spool_g">Empty spool (g)</label>
          <input id="empty_spool_g" type="number" inputmode="numeric" value={f.empty_spool_g ?? ''} onInput={number('empty_spool_g')} />
          {err('empty_spool_g')}
        </div>
      </div>
      <h3>Print settings <span class="muted">blank = {f.material} preset</span></h3>
      <div class="row">{setting('nozzle_min')}{setting('nozzle_max')}</div>
      <div class="row">{setting('bed_min')}{setting('bed_max')}</div>
      <div class="row">{setting('dry_temp')}{setting('dry_hours')}</div>
      {setting('speed_max')}
    </>
  )
}
