import { avatarColor, initials } from '../lib/utils'

interface Props {
  name: string
  userId?: number | null
  size?: number
  ring?: 'none' | 'citron' | 'dashed'
  variant?: 'color' | 'neutral'
  dim?: boolean
}

export function Avatar({ name, size = 44, ring = 'none', variant = 'color', dim = false }: Props) {
  const bg = variant === 'color' ? avatarColor(name) : 'rgba(247,245,238,.1)'
  const ringClass =
    ring === 'citron'
      ? size >= 60
        ? 'border-[3px] border-citron'
        : 'border-2 border-citron'
      : ring === 'dashed'
        ? 'border-[3px] border-dashed border-line-strong'
        : ''
  return (
    <div
      className={`flex flex-none items-center justify-center rounded-full font-semibold ${ringClass} ${dim ? 'opacity-40' : ''}`}
      style={{
        width: size,
        height: size,
        background: bg,
        color: variant === 'color' ? 'var(--color-ink)' : 'var(--color-cream)',
        fontSize: Math.max(11, Math.round(size * 0.27)),
      }}
    >
      {initials(name)}
    </div>
  )
}
