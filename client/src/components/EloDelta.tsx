import { formatEloDelta } from '../lib/utils'

/** Variation d'Elo : citron si gain, corail si perte, neutre si nul. */
export function EloDelta({ delta, className = '' }: { delta: number; className?: string }) {
  const tone = delta > 0 ? 'text-citron' : delta < 0 ? 'text-coral' : 'text-muted'
  return <span className={`font-semibold ${tone} ${className}`}>{formatEloDelta(delta)}</span>
}
