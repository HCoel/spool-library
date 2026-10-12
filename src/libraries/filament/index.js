import * as definition from './definition.js'
import Swatch from './Swatch.jsx'
import FormFields from './FormFields.jsx'
import DetailInfo from './DetailInfo.jsx'

export default {
  id: 'filament',
  label: 'Filament',
  unit_label: 'Spool',
  amount_mode: 'level',
  ...definition,
  Visual: Swatch,
  FormFields,
  DetailInfo,
}
