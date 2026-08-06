import type { AvatarColor, AvatarSymbol } from '../lib/avatar'
import { Avatar } from './Avatar'

interface PodiumPlayer {
  rank: 1 | 2 | 3
  name: string
  initials: string
  color?: AvatarColor | string | null
  symbol?: AvatarSymbol | null
  detail: string
  points: string
}

const CFG: Record<1 | 2 | 3, { height: number; bar: string; avatar: number; rank: number }> = {
  1: { height: 172, bar: 'var(--color-citron)', avatar: 84, rank: 40 },
  2: { height: 130, bar: 'var(--color-violet)', avatar: 68, rank: 30 },
  3: { height: 100, bar: 'var(--color-bronze)', avatar: 62, rank: 26 },
}

/** Top 3 uniquement — le reste de la liste passe par LeaderboardRow. Plus de double affichage
 * classement/podium. */
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
              style={{ height: c.height, borderTopColor: c.bar, borderTopWidth: 3 }}
            >
              <span className="font-display font-semibold" style={{ fontSize: c.rank, color: c.bar }}>
                {p.rank}
              </span>
              <span className="text-base font-semibold tabular-nums text-cream-soft">{p.points}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
