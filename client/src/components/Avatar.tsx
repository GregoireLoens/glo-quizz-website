import type { CSSProperties } from 'react'

import { avatarColorVar, type AvatarColor, type AvatarSymbol } from '../lib/avatar'
import { Icon } from './Icon'

const MEDAL: Record<number, string> = {
  1: 'var(--color-gold)',
  2: 'var(--color-silver)',
  3: 'var(--color-bronze)',
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
  /** Affiche le fanion de rang. `false` quand un numéro de rang est déjà visible à côté. */
  chip?: boolean
  className?: string
  style?: CSSProperties
}

/** Marque du joueur — source unique pour la nav, le salon, la partie, le classement, le
 * podium et les cartes quiz ; avant, chacun de ces endroits dessinait ses propres initiales
 * avec sa propre couleur.
 *
 * Deux axes choisis par le joueur (`color`, `symbol`), un seul gagné (`rank`). Le fanion ne
 * sort qu'à partir de 44 px — en dessous la couronne n'est plus qu'une tache — et s'efface
 * là où une colonne de rang est déjà écrite (`chip={false}`) ; l'anneau, lui, porte seul le
 * classement à toutes les tailles. Le halo autour de l'anneau est un `box-shadow` sans
 * décalage ni flou : un anneau diffus, pas une ombre portée (interdites par le système). */
export function Avatar({
  initials,
  name,
  symbol = null,
  color,
  rank = null,
  size = 38,
  solid = false,
  chip = true,
  className = '',
  style,
}: Props) {
  const c = avatarColorVar(color)
  const medal = rank ? MEDAL[rank] : undefined
  const showChip = chip && medal !== undefined && size >= 44
  const chipSize = Math.round(size * 0.42)
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
      {showChip && (
        <span
          className="absolute -bottom-0.5 -right-0.5 flex items-center justify-center rounded-full border-2 border-ink font-display font-semibold tabular-nums"
          style={{
            width: chipSize,
            height: chipSize,
            background: medal,
            color: 'var(--color-ink)',
            fontSize: Math.round(chipSize * 0.62),
          }}
        >
          {rank === 1 ? <Icon name="couronne" size={Math.round(chipSize * 0.66)} /> : rank}
        </span>
      )}
    </span>
  )
}
