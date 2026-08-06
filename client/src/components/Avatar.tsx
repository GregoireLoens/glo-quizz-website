import type { CSSProperties } from 'react'

import { avatarColorVar, type AvatarColor, type AvatarSymbol } from '../lib/avatar'
import { Icon } from './Icon'

const MEDAL: Record<number, string> = {
  1: 'var(--color-gold)',
  2: 'var(--color-silver)',
  3: 'var(--color-bronze)',
}

// Couronne de laurier du top 3, dessinée sur une grille 100×100 centrée sur le rond :
// deux tiges en arc de cercle (rayon 37, de 12° à 140°) et 7 feuilles par tige, inclinées
// pour suivre la tige. Géométrie du design system, reprise telle quelle.
const WREATH_RADIUS = 37
const ANGLE_START = 12
const ANGLE_END = 140
const LEAVES = 7

/** Point de la tige à l'angle `a` (degrés), `side` = 1 à droite, −1 à gauche. */
function wreathPoint(a: number, side: number): [number, number] {
  return [50 + side * WREATH_RADIUS * Math.sin((a * Math.PI) / 180), 50 + WREATH_RADIUS * Math.cos((a * Math.PI) / 180)]
}

function stemPath(side: number): string {
  let d = ''
  for (let i = 0; i <= 24; i++) {
    const [x, y] = wreathPoint(ANGLE_START + (i / 24) * (ANGLE_END - ANGLE_START), side)
    d += `${i ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)}`
  }
  return d
}

function Laurel({ color, size }: { color: string; size: number }) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size * 1.5}
      height={size * 1.5}
      aria-hidden
      className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 overflow-visible"
    >
      {[1, -1].map((side) => (
        <g key={side}>
          <path d={stemPath(side)} fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" />
          {Array.from({ length: LEAVES }, (_, i) => {
            const a = ANGLE_START + 6 + (i / (LEAVES - 1)) * (ANGLE_END - ANGLE_START - 14)
            const [x, y] = wreathPoint(a, side)
            return (
              <ellipse
                key={i}
                cx={x}
                cy={y}
                rx={3.4}
                ry={7.3}
                fill={color}
                transform={`rotate(${side * (106 - a)} ${x} ${y})`}
              />
            )
          })}
        </g>
      ))}
    </svg>
  )
}

interface Props {
  /** Deux lettres. Ignoré si `symbol` est renseigné. */
  initials: string
  /** Nom complet, lu par les lecteurs d'écran. */
  name?: string
  /** Icône affichée à la place des initiales. */
  symbol?: AvatarSymbol | null
  /** Couleur choisie par le joueur. */
  color?: AvatarColor | string | null
  /** 1, 2 ou 3 : anneau de médaille + fanion. Toute autre valeur ne change rien. */
  rank?: number | null
  /** Diamètre en px. 28 carte quiz · 32 nav · 38 classement · 44 partie · 76 salon · 84 podium. */
  size?: number
  /** Pastille pleine au lieu de la teinte. Réservé au joueur connecté dans la nav. */
  solid?: boolean
  /** Dessine la couronne de laurier. `false` pour ne garder que l'anneau de médaille. */
  wreath?: boolean
  className?: string
  style?: CSSProperties
}

/** Marque du joueur — source unique pour la nav, le salon, la partie, le classement, le
 * podium et les cartes quiz ; avant, chacun de ces endroits dessinait ses propres initiales
 * avec sa propre couleur.
 *
 * Deux axes choisis par le joueur (`color`, `symbol`), un seul gagné (`rank`). Les lauriers
 * n'entourent le rond qu'à partir de 44 px — en dessous les feuilles se referment en bouillie —
 * et se coupent (`wreath={false}`) là où la place manque ; l'anneau de médaille, lui, porte seul
 * le classement à toutes les tailles. Le halo autour de l'anneau est un `box-shadow` sans
 * décalage ni flou : un anneau diffus, pas une ombre portée (interdites par le système). */
export function Avatar({
  initials,
  name,
  symbol = null,
  color,
  rank = null,
  size = 38,
  solid = false,
  wreath = true,
  className = '',
  style,
}: Props) {
  const c = avatarColorVar(color)
  const medal = rank ? MEDAL[rank] : undefined
  const showWreath = wreath && medal !== undefined && size >= 44
  return (
    <span
      role="img"
      aria-label={name ?? initials}
      // rayon aussi sur la racine : c'est lui que suit un `outline` posé par l'appelant
      // (salon, partie) — sans quoi le contour « prêt » sort carré autour d'un rond
      className={`relative inline-flex flex-none rounded-full ${className}`}
      style={{ width: size, height: size, ...style }}
    >
      <span
        className="flex h-full w-full items-center justify-center rounded-full font-display font-semibold"
        style={{
          background: solid ? c : `color-mix(in oklab, ${c} 15%, transparent)`,
          border: medal
            ? `2px solid ${medal}`
            : `1px solid ${solid ? 'transparent' : `color-mix(in oklab, ${c} 34%, transparent)`}`,
          boxShadow: medal ? `0 0 0 4px color-mix(in oklab, ${medal} 15%, transparent)` : undefined,
          color: solid ? 'var(--color-ink)' : c,
          fontSize: Math.round(size * 0.38),
        }}
      >
        {symbol ? <Icon name={symbol} size={Math.round(size * 0.5)} /> : initials}
      </span>
      {showWreath && <Laurel color={medal} size={size} />}
    </span>
  )
}
