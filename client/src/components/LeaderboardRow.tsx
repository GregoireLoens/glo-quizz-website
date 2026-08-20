import type { ReactNode } from 'react'

import type { AvatarColor, AvatarSymbol } from '../lib/avatar'
import { Avatar } from './Avatar'
import { EloDelta } from './EloDelta'

interface Props {
  rank: number
  initials: string
  name: string
  color?: AvatarColor | string | null
  symbol?: AvatarSymbol | null
  /** Ligne secondaire : « 42 parties · 17 victoires » au classement général, « 8/10 bonnes
   * réponses » en fin de partie — le format dépend du contexte, formaté par l'appelant. */
  meta?: ReactNode
  /** Grand nombre à droite : Elo au classement général, points en fin de partie. */
  value: ReactNode
  delta?: number | null
  me?: boolean
}

const MEDAL: Record<number, string> = { 1: 'bg-gold text-ink', 2: 'bg-silver text-ink', 3: 'bg-bronze text-ink' }

/** Une seule pastille de rang (or/argent/bronze sur le top 3) — remplace le quadruple encodage
 * (anneau métal, pastille, bordure colorée, Elo coloré) de l'ancien classement. Sert à la fois au
 * classement général et au reste de la liste en fin de partie (le podium couvre déjà le top 3).
 *
 * Sous `sm`, valeur et delta descendent sous le nom. Alignés à droite, ils ne laissaient que
 * 80 px au pseudo et à la ligne secondaire sur un écran de 390 px : le nom cassait en plein
 * milieu et « 976 Elo » passait sur deux lignes (mesuré le 20/08/2026). */
export function LeaderboardRow({ rank, initials, name, color, symbol, meta, value, delta, me = false }: Props) {
  const eloDelta = delta !== undefined && delta !== null ? delta : null
  return (
    <div
      // py-4 et gap-4 : la couronne d'un avatar de 38 px déborde de 9,5 px tout autour, il
      // faut au moins autant d'écart avec la pastille de rang et le bloc de texte
      className={`flex items-center gap-4 rounded-lg px-3 py-4 sm:gap-6 ${
        me ? 'border border-citron/30 bg-citron/12' : 'border border-line bg-card'
      }`}
    >
      <span
        className={`flex h-[30px] w-[30px] flex-none items-center justify-center rounded-full text-sm font-semibold tabular-nums ${
          MEDAL[rank] ?? 'bg-cream/6 text-muted'
        }`}
      >
        {rank}
      </span>
      {/* le rang est déjà écrit dans la pastille de gauche ; l'avatar le redit par son
          anneau et sa couronne — glo les veut partout, taille comprise */}
      <Avatar initials={initials} name={name} color={color} symbol={symbol} rank={rank} size={38} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className={`flex items-center gap-2 text-base font-semibold ${me ? 'text-citron' : 'text-cream'}`}>
          <span className="min-w-0 truncate">{name}</span>
          {me && <span className="flex-none text-[11px] font-semibold text-muted">toi</span>}
        </span>
        {meta && <span className="text-sm text-muted-soft">{meta}</span>}
        <span className="mt-1.5 flex items-center gap-3 sm:hidden">
          <span className="font-display text-base font-semibold tabular-nums text-cream">{value}</span>
          {eloDelta !== null && <EloDelta delta={eloDelta} size="sm" />}
        </span>
      </div>
      <div className="hidden flex-none items-center gap-6 sm:flex">
        {eloDelta !== null && <EloDelta delta={eloDelta} />}
        <span className="w-[74px] text-right font-display text-lg font-semibold tabular-nums text-cream">
          {value}
        </span>
      </div>
    </div>
  )
}
