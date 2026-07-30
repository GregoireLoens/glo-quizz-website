import { avatarColor, initials } from '../lib/utils'
import { useMedal } from '../stores/leadersStore'
import { MedalRing } from './MedalRing'

interface Props {
  name: string
  /** Renseigné → médaille automatique si l'utilisateur est dans le top 3 général. */
  userId?: number | null
  size?: number
  ring?: 'none' | 'citron' | 'dashed'
  variant?: 'color' | 'neutral'
  dim?: boolean
}

export function Avatar({
  name,
  userId = null,
  size = 44,
  ring = 'none',
  variant = 'color',
  dim = false,
}: Props) {
  const medal = useMedal(userId)
  const bg = variant === 'color' ? avatarColor(name) : 'rgba(245,243,236,.1)'
  const ringClass =
    ring === 'citron'
      ? size >= 60
        ? 'border-[3px] border-citron'
        : 'border-2 border-citron'
      : ring === 'dashed'
        ? 'border-[3px] border-dashed border-cream/25'
        : ''
  return (
    <MedalRing rank={medal} size={size >= 64 ? 'lg' : size >= 40 ? 'md' : 'sm'}>
      <div
        className={`flex flex-none items-center justify-center rounded-full font-semibold ${ringClass} ${dim ? 'opacity-40' : ''}`}
        style={{
          width: size,
          height: size,
          background: bg,
          color: variant === 'color' ? '#211F1A' : '#F5F3EC',
          fontSize: Math.max(11, Math.round(size * 0.27)),
        }}
      >
        {initials(name)}
      </div>
    </MedalRing>
  )
}
