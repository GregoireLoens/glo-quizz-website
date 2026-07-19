import type { RankingEntry } from '../lib/types'
import { formatPoints } from '../lib/utils'
import { Avatar } from './Avatar'

const SPOTS = [
  { rank: 2, color: '#9C8DF2', height: 100, avatar: 64, number: 34 },
  { rank: 1, color: '#C7F45C', height: 140, avatar: 76, number: 44 },
  { rank: 3, color: '#F0492E', height: 72, avatar: 64, number: 30 },
]

export function Podium({ ranking }: { ranking: RankingEntry[] }) {
  return (
    <div className="flex items-end gap-[18px]">
      {SPOTS.map((spot) => {
        const entry = ranking.find((r) => r.rank === spot.rank)
        if (!entry) return <div key={spot.rank} className="w-[150px]" />
        return (
          <div key={spot.rank} className="flex flex-col items-center gap-2.5">
            <Avatar name={entry.username} size={spot.avatar} />
            <span
              className={`text-cream ${spot.rank === 1 ? 'text-[15px] font-bold' : 'text-sm font-semibold'}`}
            >
              {entry.username}
            </span>
            <span className="text-xs text-muted">{formatPoints(entry.score)} pts</span>
            <div
              className="flex w-[150px] items-center justify-center rounded-t-[24px]"
              style={{ height: spot.height, background: spot.color }}
            >
              <span
                className="font-display font-semibold text-ink"
                style={{ fontSize: spot.number }}
              >
                {spot.rank}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
