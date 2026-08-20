import type { RankingEntry } from '../lib/types'
import { formatPoints, initials } from '../lib/utils'
import { Avatar } from './Avatar'

interface Props {
  ranking: RankingEntry[]
  /** Classement au reveal précédent, pour les places gagnées ou perdues. */
  previous: RankingEntry[] | null
  youId: number | null
  survival?: boolean
  /** Au-delà, la liste est coupée — la ligne du joueur est toujours conservée. */
  max?: number
}

const MEDAL: Record<number, string> = { 1: 'bg-gold text-ink', 2: 'bg-silver text-ink', 3: 'bg-bronze text-ink' }

/** Classement entre deux questions. Le serveur l'envoie dans chaque `reveal` depuis toujours ;
 * il n'était affiché nulle part, si bien qu'on jouait dix questions sans savoir où on en était —
 * et donc sans pouvoir décider quand dépenser un joker.
 *
 * L'ordre vient de `_rank_key` côté serveur : bonnes réponses d'abord, les points ne départageant
 * que les ex æquo. Rien n'est recalculé ici. */
export function RoundStandings({ ranking, previous, youId, survival = false, max = 5 }: Props) {
  if (ranking.length === 0) return null

  const previousRank = new Map(previous?.map((e) => [e.playerId, e.rank]) ?? [])
  const shown = ranking.slice(0, max)
  const me = ranking.find((e) => e.playerId === youId)
  // Hors du haut de tableau, on garde quand même sa propre ligne : c'est la seule qui compte
  // pour décider de jouer un joker.
  const rows = me && !shown.includes(me) ? [...shown, me] : shown

  return (
    <div className="flex w-full flex-col gap-1.5">
      {rows.map((e, i) => {
        const before = previousRank.get(e.playerId)
        const move = before === undefined ? 0 : before - e.rank
        const you = e.playerId === youId
        const gap = i > 0 && e.rank - rows[i - 1].rank > 1
        return (
          <div
            key={e.playerId}
            className={`flex items-center gap-3 rounded-lg border px-2.5 py-2 ${
              you ? 'border-citron/30 bg-citron/12' : 'border-line bg-card'
            } ${gap ? 'mt-2' : ''}`}
          >
            <span
              className={`flex h-6 w-6 flex-none items-center justify-center rounded-full text-xs font-semibold tabular-nums ${
                MEDAL[e.rank] ?? 'bg-cream/6 text-muted'
              }`}
            >
              {e.rank}
            </span>
            <Avatar
              initials={initials(e.username)}
              name={e.username}
              color={e.avatarColor}
              symbol={e.avatarSymbol}
              size={26}
            />
            <span
              className={`min-w-0 flex-1 truncate text-sm font-semibold ${you ? 'text-citron' : 'text-cream'}`}
            >
              {e.username}
            </span>
            {move !== 0 && (
              <span
                className={`flex-none text-xs font-semibold tabular-nums ${
                  move > 0 ? 'text-citron' : 'text-coral'
                }`}
              >
                {move > 0 ? `▲ ${move}` : `▼ ${Math.abs(move)}`}
              </span>
            )}
            <span className="flex-none text-xs text-muted-soft tabular-nums">
              {survival ? '❤️'.repeat(Math.max(0, e.lives)) || '💀' : `${e.correctCount} ✓`}
            </span>
            <span className="hidden w-[68px] flex-none text-right text-sm font-semibold tabular-nums text-cream-soft sm:block">
              {formatPoints(e.score)}
            </span>
          </div>
        )
      })}
    </div>
  )
}
