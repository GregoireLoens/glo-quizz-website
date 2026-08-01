import type { ReactNode } from 'react'

export type AnswerState = 'idle' | 'choisie' | 'correcte' | 'fausse' | 'estompee'

interface Props {
  letter: string
  children: ReactNode
  state: AnswerState
  /** Étiquette en toutes lettres à droite (« Ton choix », « Bonne réponse ») — la correction ne
   * repose plus sur la seule couleur. */
  showLabel?: boolean
  disabled?: boolean
  onClick?: () => void
}

const LABEL: Partial<Record<AnswerState, string>> = { choisie: 'Ton choix', correcte: 'Bonne réponse', fausse: 'Ton choix' }

const STYLES: Record<AnswerState, { card: string; badge: string; text: string; label: string }> = {
  idle: { card: 'bg-card hover:bg-card-2', badge: 'bg-cream/7 text-cream-soft', text: 'font-medium text-cream', label: 'text-citron' },
  choisie: { card: 'bg-citron', badge: 'bg-ink text-citron', text: 'font-semibold text-ink', label: 'text-ink' },
  correcte: {
    card: 'bg-citron/9 border-citron/45',
    badge: 'bg-citron text-ink',
    text: 'font-semibold text-cream',
    label: 'text-citron',
  },
  fausse: {
    card: 'bg-coral/8 border-coral/50',
    badge: 'bg-coral text-ink',
    text: 'font-semibold text-cream',
    label: 'text-coral',
  },
  estompee: {
    card: 'bg-ink-2 opacity-45',
    badge: 'bg-cream/7 text-cream-soft',
    text: 'font-medium text-cream-soft',
    label: 'text-citron',
  },
}

/** 5 états, étiquette en toutes lettres — les réponses non choisies s'estompent à 45 % au lieu
 * de disparaître. */
export function AnswerCard({ letter, children, state, showLabel = true, disabled = false, onClick }: Props) {
  const s = STYLES[state]
  const label = showLabel ? LABEL[state] : undefined
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex min-h-16 w-full cursor-pointer items-center gap-3.5 rounded-lg border border-transparent px-5 py-3.5 text-left transition disabled:cursor-default sm:min-h-20 sm:gap-4 sm:px-[26px] ${s.card}`}
    >
      <span className={`flex h-8 w-8 flex-none items-center justify-center rounded-sm text-sm font-semibold ${s.badge}`}>
        {state === 'correcte' ? '✓' : letter}
      </span>
      <span className={`flex-1 text-base sm:text-lg ${s.text}`}>{children}</span>
      {label && <span className={`flex-none text-xs font-semibold uppercase tracking-[0.6px] ${s.label}`}>{label}</span>}
    </button>
  )
}
