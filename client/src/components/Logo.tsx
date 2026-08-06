const TONES: Record<string, string> = {
  citron: 'var(--color-citron)',
  cream: 'var(--color-cream)',
  ink: 'var(--color-ink)',
}

const RATIO = 142 / 90

export interface LogoProps {
  /** lockup = monogramme + mot ; mono = monogramme seul ; wordmark = mot seul */
  variant?: 'lockup' | 'mono' | 'wordmark'
  /** hauteur du monogramme en px (hauteur de capitale du mot pour `wordmark`) */
  size?: number
  /** couleur du monogramme */
  tone?: 'citron' | 'cream' | 'ink'
  /** couleur du mot — le laisser sur `cream`, sauf sur fond citron */
  wordTone?: 'citron' | 'cream' | 'ink'
  /** écart monogramme / mot, en px. Par défaut 0,38 × size */
  gap?: number
  label?: string
  className?: string
}

/**
 * Logo MidiQuizz — monogramme citron + logotype crème (design system, `foundations/logo.html`).
 *
 * `size` est la hauteur du monogramme : le corps du mot (0,73 × size) et l'écart (0,38 × size)
 * s'en déduisent, il n'y a donc qu'un seul nombre à régler.
 *
 * Règles à ne pas contourner :
 * - **le citron ne vit que dans le monogramme** — recolorer une partie du mot le fait ressembler
 *   à du texte sélectionné (c'est ce que faisait l'ancien mot-symbole `Midi<span>Quizz</span>`) ;
 * - taille mini 20 en lockup, 16 en mono — en dessous, passer au monogramme seul ;
 * - sur fond citron, tout passe en ink (`tone="ink" wordTone="ink"`) ;
 * - zone de respiration = 0,5 × la hauteur du monogramme, rien n'y entre.
 */
export function Logo({
  variant = 'lockup',
  size = 32,
  tone = 'citron',
  wordTone = 'cream',
  gap,
  label = 'MidiQuizz',
  className,
}: LogoProps) {
  const mark = (
    <svg
      viewBox="-3 5 142 90"
      height={size}
      width={Math.round(size * RATIO)}
      role="img"
      aria-label={variant === 'mono' ? label : undefined}
      aria-hidden={variant === 'mono' ? undefined : true}
      className="block flex-none"
    >
      <g fill="none" stroke={TONES[tone]} strokeWidth="14" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 82V18l27 39 27-39v64" />
        <circle cx="99" cy="50" r="25" />
        <path d="M117 68l9 9" />
      </g>
    </svg>
  )
  if (variant === 'mono') return <span className={className}>{mark}</span>

  const word = (
    <span
      className="whitespace-nowrap font-display font-semibold leading-none tracking-[-0.028em]"
      style={{ fontSize: Math.round(size * 0.73), color: TONES[wordTone] }}
    >
      {label}
    </span>
  )
  if (variant === 'wordmark') return <span className={className}>{word}</span>

  return (
    <span
      className={`inline-flex flex-none items-center ${className ?? ''}`}
      style={{ gap: gap ?? Math.round(size * 0.38) }}
    >
      {mark}
      {word}
    </span>
  )
}
