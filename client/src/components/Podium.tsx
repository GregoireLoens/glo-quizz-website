import type { AvatarColor, AvatarSymbol } from '../lib/avatar'
import { Avatar } from './Avatar'
import { EloDelta } from './EloDelta'

interface PodiumPlayer {
  rank: 1 | 2 | 3
  name: string
  initials: string
  color?: AvatarColor | string | null
  symbol?: AvatarSymbol | null
  detail: string
  points: string
  /** Rating après la partie et sa variation. Absent sur une partie non classée (solo). */
  elo?: { rating: string; delta: number } | null
}

const CFG: Record<1 | 2 | 3, { height: number; eloHeight: number; bar: string; avatar: number; rank: number }> = {
  1: { height: 172, eloHeight: 206, bar: 'var(--color-citron)', avatar: 84, rank: 40 },
  2: { height: 130, eloHeight: 156, bar: 'var(--color-violet)', avatar: 68, rank: 30 },
  3: { height: 100, eloHeight: 120, bar: 'var(--color-bronze)', avatar: 62, rank: 26 },
}

/** Top 3 uniquement — le reste de la liste passe par LeaderboardRow. Plus de double affichage
 * classement/podium. La marche s'allonge quand elle porte l'Elo, pour que le rang garde sa place. */
export function Podium({ players }: { players: PodiumPlayer[] }) {
  const by = (rank: 1 | 2 | 3) => players.find((p) => p.rank === rank)
  const order = [by(2), by(1), by(3)].filter((p): p is PodiumPlayer => Boolean(p))
  return (
    <div className="flex items-end justify-center gap-3 sm:gap-4">
      {order.map((p) => {
        const c = CFG[p.rank]
        return (
          <div key={p.rank} className="flex w-[110px] flex-col items-center gap-2.5 sm:w-[160px]">
            {/* les trois marches portent leurs lauriers : 62 px au plus petit, bien au-dessus
                du seuil de 44 */}
            <Avatar
              initials={p.initials}
              name={p.name}
              color={p.color}
              symbol={p.symbol}
              rank={p.rank}
              size={c.avatar}
            />
            <div className="flex flex-col items-center gap-0.5 text-center">
              <span className="max-w-full truncate text-base font-semibold text-cream">{p.name}</span>
              <span className="max-w-full truncate text-sm text-muted-soft">{p.detail}</span>
            </div>
            <div
              className="flex w-full flex-col items-center justify-center gap-1.5 rounded-t-xl border-x border-t border-line bg-card"
              style={{ height: p.elo ? c.eloHeight : c.height, borderTopColor: c.bar, borderTopWidth: 3 }}
            >
              <span className="font-display font-semibold" style={{ fontSize: c.rank, color: c.bar }}>
                {p.rank}
              </span>
              <span className="text-base font-semibold tabular-nums text-cream-soft">{p.points}</span>
              {p.elo && (
                <div className="mt-0.5 flex flex-col items-center gap-1">
                  <span className="text-[12.5px] tabular-nums text-muted-soft">{p.elo.rating} Elo</span>
                  <EloDelta delta={p.elo.delta} size="sm" unit={false} />
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
