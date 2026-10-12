import { useId } from 'preact/hooks'
import { isHex } from '../../core/color.js'
import { pieSlices, shade, sparklePoints } from './swatch-geometry.js'

const FULL = { width: 100, height: 100 }

export default function Swatch({ product, size = 64 }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const id = key => `${key}-${uid}`
  const f = product.fields
  const hex = isHex(f.color_hex) ? f.color_hex : '#888888'
  const extra = [f.color_hex_2, f.color_hex_3].filter(isHex)

  let body
  switch (f.finish) {
    case 'matte':
      body = <rect {...FULL} fill={hex} />
      break
    case 'silk':
      body = <><rect {...FULL} fill={hex} /><rect {...FULL} fill={`url(#${id('silk')})`} /></>
      break
    case 'sparkle':
      body = <>
        <rect {...FULL} fill={hex} />
        {sparklePoints(product.id ?? 'preview').map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={p.r} fill="#fff" fill-opacity={p.o} />)}
      </>
      break
    case 'translucent':
      body = <><rect {...FULL} fill={`url(#${id('check')})`} /><rect {...FULL} fill={hex} fill-opacity="0.6" /></>
      break
    case 'multi': {
      const slices = pieSlices([hex, ...extra])
      body = slices.length ? slices.map((s, i) => <path key={i} d={s.d} fill={s.color} />) : <rect {...FULL} fill={hex} />
      break
    }
    case 'glow':
      body = <>
        <rect {...FULL} fill={hex} />
        <circle cx="50" cy="50" r="44" fill="none" stroke={shade(hex, 0.6)} stroke-width="5" filter={`url(#${id('blur')})`} />
      </>
      break
    case 'wood':
      body = <>
        <rect {...FULL} fill={hex} />
        {[12, 26, 40, 54, 68, 82].map((y, i) => (
          <path key={y} d={`M0 ${y} Q50 ${y + (i % 2 ? 7 : -7)} 100 ${y}`} fill="none" stroke={shade(hex, -0.35)} stroke-opacity="0.55" stroke-width="2.5" />
        ))}
      </>
      break
    default:
      body = <><rect {...FULL} fill={hex} /><rect {...FULL} fill={`url(#${id('gloss')})`} /></>
  }

  return (
    <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label={`${f.color_name || hex}, ${f.finish}`}>
      <defs>
        <clipPath id={id('clip')}><circle cx="50" cy="50" r="48" /></clipPath>
        <radialGradient id={id('gloss')} cx="35%" cy="25%" r="60%">
          <stop offset="0" stop-color="#fff" stop-opacity="0.45" />
          <stop offset="1" stop-color="#fff" stop-opacity="0" />
        </radialGradient>
        <linearGradient id={id('silk')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#000" stop-opacity="0.15" />
          <stop offset="0.45" stop-color="#fff" stop-opacity="0" />
          <stop offset="0.5" stop-color="#fff" stop-opacity="0.75" />
          <stop offset="0.58" stop-color="#fff" stop-opacity="0" />
          <stop offset="1" stop-color="#000" stop-opacity="0.25" />
        </linearGradient>
        <pattern id={id('check')} width="16" height="16" patternUnits="userSpaceOnUse">
          <rect width="16" height="16" fill="#fff" />
          <rect width="8" height="8" fill="#ccc" />
          <rect x="8" y="8" width="8" height="8" fill="#ccc" />
        </pattern>
        <filter id={id('blur')}><feGaussianBlur stdDeviation="2.5" /></filter>
      </defs>
      <g clip-path={`url(#${id('clip')})`}>{body}</g>
      <circle cx="50" cy="50" r="48" fill="none" stroke="#000" stroke-opacity="0.25" stroke-width="1.5" />
      <circle cx="50" cy="50" r="13" fill="var(--hole, var(--bg))" stroke="#000" stroke-opacity="0.25" stroke-width="1.5" />
    </svg>
  )
}
