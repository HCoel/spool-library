export function checkRange(errors, key, value, min, max, { required = false } = {}) {
  if (value === null || value === undefined || value === '') {
    if (required) errors[key] = 'Required'
    return
  }
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    errors[key] = `Must be ${min}-${max}`
  }
}

export function checkOrder(errors, key, lo, hi) {
  if (lo == null || hi == null || errors[key]) return
  if (lo > hi) errors[key] = 'Max must be at least min'
}
