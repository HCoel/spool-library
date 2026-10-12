export default function ProductCard({ lib, row }) {
  const { product, units, activeCount } = row
  const Visual = lib.Visual
  return (
    <a class={`tile${activeCount === 0 ? ' dim' : ''}`} href={`#/p/${product.id}`} aria-label={product.name}>
      <Visual product={product} size={64} />
      <strong>{product.fields.color_name || product.name}</strong>
      <span class="muted">{lib.summary(product, units)}</span>
    </a>
  )
}
