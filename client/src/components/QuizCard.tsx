import type { QuizSummary } from '../lib/types'
import { formatPlays, initials } from '../lib/utils'

const ACCENTS = ['#C7F45C', '#9C8DF2', '#F0492E']

interface Props {
  quiz: QuizSummary
  index?: number
  onPlay?: () => void
  busy?: boolean
}

export function QuizCard({ quiz, index = 0, onPlay, busy = false }: Props) {
  const accent = ACCENTS[index % ACCENTS.length]
  return (
    <div className="flex flex-col gap-4 rounded-[28px] bg-card p-6">
      <div
        className="flex h-14 w-14 items-center justify-center rounded-[20px] text-[26px]"
        style={{ background: accent }}
      >
        {quiz.emoji}
      </div>
      <div className="flex flex-col gap-1">
        <span className="font-display text-[19px] font-semibold text-cream">{quiz.title}</span>
        <span className="text-[13px] text-muted">
          {quiz.questionCount} question{quiz.questionCount > 1 ? 's' : ''} ·{' '}
          {formatPlays(quiz.playCount)} partie{quiz.playCount > 1 ? 's' : ''}
        </span>
      </div>
      <div className="mt-auto flex items-center gap-2.5">
        <div className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-cream/10 text-[11px] font-semibold text-cream">
          {initials(quiz.author.username)}
        </div>
        <span className="flex-1 text-xs text-muted">{quiz.author.username}</span>
        <button
          type="button"
          onClick={onPlay}
          disabled={busy}
          title="Lancer une partie avec ce quiz"
          className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-ink text-base transition hover:brightness-125 disabled:opacity-40"
          style={{ color: accent }}
        >
          ▶
        </button>
      </div>
    </div>
  )
}
