import * as definition from './definition.js'
import Swatch from './Swatch.jsx'
import FormFields from './FormFields.jsx'

export default {
  id: 'filament',
  label: 'Filament',
  unit_label: 'Spool',
  amount_mode: 'level',
  ...definition,
  Visual: Swatch,
  FormFields,
}
