import { Avatar } from '../../components/Avatar'
import { AnswerCard, type AnswerState } from '../../components/AnswerCard'
import { CircularTimer } from '../../components/CircularTimer'
import { PillButton } from '../../components/PillButton'
import { formatPoints } from '../../lib/utils'
import { gameSocket } from '../../lib/ws'
import { useGameStore } from '../../stores/gameStore'

const LETTERS = ['A', 'B', 'C', 'D']

export function PlayingView() {
  const {
    phase,
    youId,
    players,
    question,
    questionStartedAt,
    selectedAnswer,
    locked,
    reveal,
    select,
  } = useGameStore()

  if (!question) return null

  const isReveal = phase === 'reveal'
  const myResult = reveal?.results.find((r) => r.playerId === youId)

  const answerState = (index: number): AnswerState => {
    if (isReveal && reveal) {
      if (index === reveal.correctIndex) return 'correct'
      if (index === selectedAnswer) return 'wrong'
      return 'dimmed'
    }
    return index === selectedAnswer ? 'selected' : 'idle'
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center px-6">
      {/* avatars + progression */}
      <div className="relative mt-7 flex flex-wrap items-center justify-center gap-2.5">
        {players.map((p) => (
          <div key={p.id} className="relative">
            <Avatar
              name={p.username}
              size={44}
              ring={p.id === youId ? 'citron' : 'none'}
              dim={!p.connected}
            />
            {p.answered && !isReveal && (
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-citron text-[10px] font-bold text-ink">
                ✓
              </span>
            )}
          </div>
        ))}
        <div className="ml-2 flex h-11 items-center rounded-full bg-cream/8 px-4">
          <span className="text-[13px] font-semibold text-cream-soft">
            Question {question.index + 1} / {question.total}
          </span>
        </div>
      </div>

      {/* minuteur */}
      <div className="relative mt-9">
        {isReveal ? (
          <div className="flex h-24 flex-col items-center justify-center">
            {myResult && (
              <>
                <span
                  className={`font-display text-4xl font-semibold ${myResult.correct ? 'text-citron' : 'text-coral'}`}
                >
                  {myResult.correct ? `+${formatPoints(myResult.pointsEarned)}` : '+0'}
                </span>
                <span className="text-[13px] text-muted">
                  {myResult.correct
                    ? 'Bonne réponse !'
                    : myResult.answerIndex === null
                      ? 'Pas de réponse'
                      : 'Mauvaise réponse'}
                </span>
              </>
            )}
          </div>
        ) : (
          questionStartedAt && (
            <CircularTimer duration={question.duration} startedAt={questionStartedAt} />
          )
        )}
      </div>

      <h1 className="relative mt-9 max-w-[760px] text-center font-display text-[28px] font-semibold leading-[1.2] text-cream md:text-[40px]">
        {question.text}
      </h1>

      {/* réponses */}
      <div className="relative mt-10 grid w-full max-w-[760px] grid-cols-1 gap-[18px] md:grid-cols-2">
        {question.answers.map((answer, i) => (
          <AnswerCard
            key={i}
            letter={LETTERS[i]}
            text={answer}
            state={answerState(i)}
            disabled={locked || isReveal}
            onClick={() => select(i)}
          />
        ))}
      </div>

      {/* validation */}
      <div className="relative mb-16 mt-9 flex w-full max-w-[760px] items-center gap-4">
        <span className="flex-1 text-[13px] text-muted">
          {isReveal
            ? 'La question suivante arrive…'
            : locked
              ? 'Réponse envoyée — en attente des autres joueurs.'
              : 'Réponse enregistrée dès validation.'}
        </span>
        {!isReveal && (
          <PillButton
            variant="cream"
            disabled={selectedAnswer === null || locked}
            onClick={() => {
              if (selectedAnswer !== null) {
                gameSocket.send({
                  type: 'answer',
                  questionIndex: question.index,
                  answerIndex: selectedAnswer,
                })
              }
            }}
          >
            Valider →
          </PillButton>
        )}
      </div>
    </div>
  )
}
