import { Icon } from './Icon'

interface Props {
  lives: number
  total?: number
  size?: 'md' | 'lg'
  showLabel?: boolean
  className?: string
}

export function SurvivalBadge({ lives, total = 3, size = 'md', showLabel = true, className = '' }: Props) {
  const lg = size === 'lg'
  return (
    <span
      className={`inline-flex items-center gap-2.5 rounded-full border border-coral/38 bg-coral/12 font-semibold text-coral ${
        lg ? 'h-11 px-[18px] text-base' : 'h-8 px-[13px] text-sm'
      } ${className}`}
    >
      {showLabel && <span>Mode Survie</span>}
      <span className="inline-flex gap-1">
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className={i < lives ? 'flex opacity-100' : 'flex opacity-30'}>
            <Icon name="vie" size={lg ? 20 : 15} />
          </span>
        ))}
      </span>
    </span>
  )
}
