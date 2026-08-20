import { useState, type ReactNode } from 'react'

interface Props {
  /** Le résumé affiché au survol — une phrase, pas un paragraphe. */
  label: ReactNode
  children: ReactNode
  className?: string
}

/** Infobulle au survol et au focus clavier. Absente du design system, elle en reprend les
 * fondations : surface `ink`, filet `line`, aucune ombre portée.
 *
 * Pilotée par un état React plutôt que par `group-hover` : sur ce projet, deux utilitaires
 * de `display` qui s'opposent se départagent à l'ordre du CSS généré, ce qui a déjà fait
 * apparaître les deux logos de la nav en même temps. Un état explicite ne dépend de rien,
 * se teste, et couvre le focus clavier du même geste.
 *
 * Elle ne porte jamais une information indispensable : le survol n'existe pas au tactile.
 * Le détail complet vit sur `/jokers`. */
export function Tooltip({ label, children, className = '' }: Props) {
  const [open, setOpen] = useState(false)
  return (
    <span
      className={`relative inline-flex ${className}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      {open && (
        <span
          role="tooltip"
          className="pointer-events-none absolute bottom-[calc(100%+10px)] left-1/2 z-30 w-max max-w-[min(240px,70vw)] -translate-x-1/2 rounded-lg border border-line bg-ink px-3 py-2 text-center text-[13px] leading-snug text-cream-soft"
        >
          {label}
        </span>
      )}
    </span>
  )
}
