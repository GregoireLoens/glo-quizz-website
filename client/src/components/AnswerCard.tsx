export type AnswerState = 'idle' | 'selected' | 'correct' | 'wrong' | 'dimmed'

interface Props {
  letter: string
  text: string
  state: AnswerState
  disabled?: boolean
  onClick?: () => void
}

export function AnswerCard({ letter, text, state, disabled = false, onClick }: Props) {
  const card =
    state === 'selected' || state === 'correct'
      ? 'bg-citron text-ink'
      : state === 'wrong'
        ? 'bg-coral text-ink'
        : state === 'dimmed'
          ? 'bg-card opacity-45'
          : 'bg-card hover:bg-[#2e2b23]'
  const badge =
    state === 'selected' || state === 'correct'
      ? 'bg-ink text-citron'
      : state === 'wrong'
        ? 'bg-ink text-coral'
        : 'bg-cream/10 text-cream'

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex min-h-20 w-full cursor-pointer items-center gap-3.5 rounded-[26px] px-5 py-4 text-left transition disabled:cursor-default sm:min-h-24 sm:gap-4 sm:px-[26px] ${card}`}
    >
      <span
        className={`flex h-9 w-9 flex-none items-center justify-center rounded-full text-sm font-semibold ${badge}`}
      >
        {letter}
      </span>
      <span
        className={`flex-1 text-base sm:text-lg ${state === 'selected' || state === 'correct' || state === 'wrong' ? 'font-semibold' : 'font-medium text-cream'}`}
      >
        {text}
      </span>
      {(state === 'selected' || state === 'correct') && <span className="text-xl">✓</span>}
      {state === 'wrong' && <span className="text-xl">✕</span>}
    </button>
  )
}
