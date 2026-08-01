import type { ReactNode } from 'react'

interface Props {
  children: ReactNode
  tone?: 'neutre' | 'actif' | 'citron'
  className?: string
}

const TONES: Record<NonNullable<Props['tone']>, string> = {
  neutre: 'border border-line-strong bg-cream/7 text-cream-soft',
  actif: 'border border-transparent bg-ink text-citron',
  citron: 'border border-transparent bg-citron/13 text-citron',
}

/** Badge de raccourci clavier (A/B/C/D, Entrée) — prêt pour le chantier « ajouts fonctionnels »,
 * pas encore câblé dans les écrans. */
export function KeyHint({ children, tone = 'neutre', className = '' }: Props) {
  return (
    <kbd
      className={`inline-flex h-7 min-w-7 items-center justify-center rounded-sm px-2 text-sm font-semibold ${TONES[tone]} ${className}`}
    >
      {children}
    </kbd>
  )
}
