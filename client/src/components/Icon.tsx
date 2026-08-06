import type { ReactElement, SVGProps } from 'react'

const STROKE = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

const PATHS: Record<string, ReactElement> = {
  chercher: (
    <g {...STROKE}>
      <circle cx={11} cy={11} r={7} />
      <path d="M20 20l-3.6-3.6" />
    </g>
  ),
  jouer: (
    <g fill="currentColor">
      <path d="M8 5.2v13.6L19 12z" />
    </g>
  ),
  joueurs: (
    <g {...STROKE}>
      <circle cx={9} cy={8} r={3.5} />
      <path d="M3 19c0-3 2.7-5 6-5s6 2 6 5" />
      <path d="M16 5.5a3.5 3.5 0 010 6.4M17 14.5c2.4.6 4 2.3 4 4.5" />
    </g>
  ),
  minuteur: (
    <g {...STROKE}>
      <circle cx={12} cy={12} r={8.5} />
      <path d="M12 7.5V12l3 2" />
    </g>
  ),
  trophee: (
    <g {...STROKE}>
      <path d="M7 4h10v5.2a5 5 0 01-10 0z" />
      <path d="M7 5.8H4.6v1.1A3.4 3.4 0 008 10.3M17 5.8h2.4v1.1a3.4 3.4 0 01-3.4 3.4" />
      <path d="M12 14.2V17M9.2 20h5.6" />
    </g>
  ),
  vie: (
    <g fill="currentColor">
      <path d="M12 20.5S4 15.6 4 10.4A4.4 4.4 0 0112 7.9a4.4 4.4 0 018 2.5c0 5.2-8 10.1-8 10.1z" />
    </g>
  ),
  serie: (
    <g fill="currentColor">
      <path d="M13.4 2.5L5 13.6h5.3l-1 8 8.8-11.4h-5.4z" />
    </g>
  ),
  copier: (
    <g {...STROKE}>
      <rect x={9} y={9} width={11} height={11} rx={3} />
      <path d="M15 5.6A2.6 2.6 0 0012.4 3H6.5A3.5 3.5 0 003 6.5v6A2.6 2.6 0 005.6 15" />
    </g>
  ),
  partager: (
    <g {...STROKE}>
      <path d="M12 3.5v11M8.2 7L12 3.5 15.8 7" />
      <path d="M5 13v5.6A2.4 2.4 0 007.4 21h9.2a2.4 2.4 0 002.4-2.4V13" />
    </g>
  ),
  clavier: (
    <g {...STROKE}>
      <rect x={2.5} y={6} width={19} height={12} rx={3} />
      <path d="M7 10h.01M11 10h.01M15 10h.01M8 14h8" />
    </g>
  ),
  editer: (
    <g {...STROKE}>
      <path d="M4 20l4-1 11-11-3-3L5 16z" />
      <path d="M14.5 6.5l3 3" />
    </g>
  ),
  supprimer: (
    <g {...STROKE}>
      <path d="M4 7h16M9.5 7V5h5v2M6.5 7l1 13h9l1-13" />
    </g>
  ),
  // du jeu d'icônes du design system ; sans emploi depuis que le top 3 porte des lauriers
  couronne: (
    <g fill="currentColor">
      <path d="M4.6 18.4h14.8l1.35-10.6-5.25 4.05L12 5.6 8.5 11.85 3.25 7.8z" />
    </g>
  ),
}

export type IconName = keyof typeof PATHS

interface Props extends SVGProps<SVGSVGElement> {
  name: IconName
  size?: number
  label?: string
}

/** 13 icônes dessinées (grille 24px, trait 1,8, currentColor) — remplacent les emoji d'interface
 * (🔍 ▶ 🎲 ⚠️ ✓ ✕ ▼) qui changeaient de forme selon l'OS. Les emoji restent là où ils sont du
 * contenu (vignette de thème de quiz, trophée de fin de partie). */
export function Icon({ name, size = 22, label, className = '', ...rest }: Props) {
  const group = PATHS[name]
  if (!group) return null
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      role={label ? 'img' : 'presentation'}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={`block flex-none ${className}`}
      {...rest}
    >
      {group}
    </svg>
  )
}
