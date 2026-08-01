import { formatEloDelta } from '../lib/utils'

interface Props {
  delta: number
  rankChange?: number
  size?: 'md' | 'lg'
  className?: string
}

/** Variation d'Elo : citron si gain, corail si perte, neutre si nul. `rankChange` (optionnel)
 * accompagne le delta du changement de rang général — l'information qui manquait avant. */
export function EloDelta({ delta, rankChange, size = 'md', className = '' }: Props) {
  const up = delta > 0
  const flat = delta === 0
  const tone = flat ? 'text-muted-soft' : up ? 'text-citron' : 'text-coral'
  const bg = flat ? 'bg-cream/8' : up ? 'bg-citron/14' : 'bg-coral/12'
  const rankLabel =
    rankChange === undefined || rankChange === 0
      ? null
      : rankChange > 0
        ? `${rankChange} place${rankChange > 1 ? 's' : ''} gagnée${rankChange > 1 ? 's' : ''}`
        : `${Math.abs(rankChange)} place${rankChange < -1 ? 's' : ''} perdue${rankChange < -1 ? 's' : ''}`

  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span
        className={`inline-flex items-center rounded-full px-2.5 font-semibold tabular-nums ${bg} ${tone} ${
          size === 'lg' ? 'h-[34px] text-xl' : 'h-7 text-base'
        }`}
      >
        {formatEloDelta(delta)}
        <span className="ml-1 text-xs opacity-80">Elo</span>
      </span>
      {rankLabel && <span className="text-sm text-muted-soft">{rankLabel}</span>}
    </span>
  )
}
