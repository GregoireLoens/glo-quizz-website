import type { AvatarColor, AvatarSymbol } from '../lib/avatar'
import { Avatar } from './Avatar'

interface Props {
  initials: string
  name: string
  color?: AvatarColor | string | null
  symbol?: AvatarSymbol | null
  /** Place au classement général (top 3) — l'anneau de médaille suit le joueur partout. */
  rank?: number | null
  host?: boolean
  ready?: boolean
  /** Déconnecté (reconnexion WS en cours) — pas dans la maquette d'origine, ajouté : ce signal
   * existe réellement dans le jeu et ne doit pas se perdre dans la refonte. */
  pending?: boolean
  size?: number
}

export function PlayerBubble({
  initials,
  name,
  color,
  symbol,
  rank,
  host = false,
  ready = false,
  pending = false,
  size = 76,
}: Props) {
  const on = (host || ready) && !pending
  const label = pending ? 'Déconnecté' : host ? 'Hôte' : ready ? 'Prêt' : 'En attente'
  return (
    <div className="flex flex-col items-center gap-2.5" style={{ width: size + 40 }}>
      {/* Le contour citron dit « prêt », l'anneau de l'avatar dit le classement : deux cercles
          distincts, jamais la même information. */}
      <Avatar
        initials={initials}
        name={name}
        color={color}
        symbol={symbol}
        rank={rank}
        size={size}
        style={{
          opacity: pending ? 0.4 : on ? 1 : 0.6,
          outline: on ? '2px solid var(--color-citron)' : undefined,
          outlineOffset: 3,
        }}
      />
      <span className="max-w-full truncate text-sm font-semibold text-cream">{name}</span>
      <span
        className={`inline-flex h-[22px] items-center rounded-full px-2.5 text-[11px] font-semibold ${
          on ? 'bg-citron/14 text-citron' : 'bg-cream/7 text-muted-soft'
        }`}
      >
        {label}
      </span>
    </div>
  )
}
