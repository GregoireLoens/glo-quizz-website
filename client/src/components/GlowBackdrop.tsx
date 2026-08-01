interface Props {
  color?: string
  x?: string
  y?: string
  size?: number
  opacity?: number
  className?: string
}

/** Un seul halo par écran (au lieu de 2-3 flous identiques superposés sur chaque page) —
 * repositionné selon le contenu. Moins coûteux en peinture, la décoration redevient un accent.
 * Le parent doit rester `relative overflow-hidden` pour le clipper correctement. */
export function GlowBackdrop({
  color = 'var(--color-citron)',
  x = '50%',
  y = '0%',
  size = 720,
  opacity = 0.16,
  className = '',
}: Props) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full ${className}`}
      style={{
        left: x,
        top: y,
        width: size,
        height: size,
        background: `radial-gradient(circle, color-mix(in oklab, ${color} ${Math.round(opacity * 100)}%, transparent) 0%, transparent 68%)`,
      }}
    />
  )
}
