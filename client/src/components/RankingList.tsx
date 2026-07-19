import type { RankingEntry } from '../lib/types'
import { formatPoints, initials } from '../lib/utils'

interface Props {
  ranking: RankingEntry[]
  youId: number | null
  questionTotal: number
}

export function RankingList({ ranking, youId, questionTotal }: Props) {
  return (
    <div className="flex w-full max-w-[640px] flex-col gap-1 rounded-3xl bg-card p-2">
      {ranking.map((entry) => {
        const winner = entry.rank === 1
        const accent = winner ? 'text-citron' : 'text-cream'
        return (
          <div
            key={entry.playerId}
            className={`flex items-center gap-3.5 rounded-2xl px-4 py-3 ${winner ? 'bg-citron/14' : ''}`}
          >
            <span className={`w-5 text-center text-[13px] font-bold ${winner ? 'text-citron' : 'text-muted'}`}>
              {entry.rank}
            </span>
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold ${
                winner ? 'bg-citron text-ink' : 'bg-cream/10 text-cream'
              }`}
            >
              {initials(entry.username)}
            </div>
            <span className={`flex-1 text-[13.5px] font-semibold ${accent}`}>
              {entry.username}
              {entry.playerId === youId && ' (vous)'}
            </span>
            <span className={`text-xs ${winner ? 'text-citron' : 'text-muted'}`}>
              {entry.correctCount}/{questionTotal} bonnes réponses
            </span>
            <span className={`text-[13.5px] font-bold ${accent}`}>
              {formatPoints(entry.score)} pts
            </span>
          </div>
        )
      })}
    </div>
  )
}
