import { useCallback, useEffect, useRef } from 'react'

import { AnswerCard, type AnswerState } from '../../components/AnswerCard'
import { Avatar } from '../../components/Avatar'
import { Button } from '../../components/Button'
import { KeyHint } from '../../components/KeyHint'
import { Timer } from '../../components/Timer'
import { formatPoints, initials } from '../../lib/utils'
import { gameSocket } from '../../lib/ws'
import { useGameStore } from '../../stores/gameStore'
import { useMedals } from '../../stores/leadersStore'

const LETTERS = ['A', 'B', 'C', 'D']

// Raccourcis de sélection. Les lettres passent par `key` (elles tombent au même endroit
// en AZERTY comme en QWERTY) ; les chiffres passent par `code`, sinon il faudrait Shift
// sur un clavier français pour obtenir un « 1 ».
const ANSWER_KEYS: Record<string, number> = { a: 0, b: 1, c: 2, d: 3 }
const ANSWER_CODES: Record<string, number> = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3 }

// Marge avant la fin du décompte pour que l'envoi automatique atteigne le serveur
// avant qu'il ne clôture la question (config.ANSWER_GRACE_SECONDS = 0,5 s côté serveur).
const AUTO_SUBMIT_LEAD_MS = 200

export function PlayingView() {
  const {
    phase,
    youId,
    players,
    settings,
    question,
    questionStartedAt,
    selectedAnswer,
    locked,
    reveal,
    select,
  } = useGameStore()
  const medals = useMedals()

  // Une réponse ne part qu'une fois par question. `locked` n'arrive qu'avec l'ack du
  // serveur : cliquer « Valider » puis appuyer sur Entrée déclenchait les deux chemins
  // avant le retour (le navigateur active aussi le bouton qui a le focus), et le second
  // envoi se faisait refuser en `already_answered`. Le repère est `questionStartedAt`,
  // horodatage propre à chaque question — un `play_again` repart à l'index 0 sans
  // rejouer un index déjà marqué.
  const sentAt = useRef<number | null>(null)
  const submit = useCallback(() => {
    const s = useGameStore.getState()
    const me = s.players.find((p) => p.id === s.youId)
    const out = (s.settings?.survival ?? false) && me !== undefined && me.lives <= 0
    if (s.phase !== 'question' || s.locked || out) return
    if (s.question === null || s.selectedAnswer === null || s.questionStartedAt === null) return
    if (sentAt.current === s.questionStartedAt) return
    sentAt.current = s.questionStartedAt
    gameSocket.send({
      type: 'answer',
      questionIndex: s.question.index,
      answerIndex: s.selectedAnswer,
    })
  }, [])

  // Validation automatique : une réponse sélectionnée mais non validée part quand même
  // à la fin du décompte. Planifié une seule fois par question (l'état est relu à
  // l'échéance via getState(), donc changer de sélection ne replanifie rien).
  const questionIndex = question?.index ?? null
  const questionDuration = question?.duration ?? 0
  useEffect(() => {
    if (questionIndex === null || questionStartedAt === null) return
    const delay = questionStartedAt + questionDuration * 1000 - AUTO_SUBMIT_LEAD_MS - Date.now()
    if (delay <= 0) return // question déjà terminée (reconnexion tardive) : le serveur refuserait
    const id = setTimeout(() => {
      if (useGameStore.getState().question?.index !== questionIndex) return
      submit()
    }, delay)
    return () => clearTimeout(id)
  }, [questionIndex, questionDuration, questionStartedAt, submit])

  // Clavier : A–D (ou 1–4) choisit, Entrée valide. Comme pour la validation automatique,
  // l'état est relu à la volée via getState() — l'écouteur n'est branché qu'une fois et
  // ne se rebranche pas à chaque sélection.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const target = e.target as HTMLElement | null
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return

      const s = useGameStore.getState()
      const me = s.players.find((p) => p.id === s.youId)
      const out = (s.settings?.survival ?? false) && me !== undefined && me.lives <= 0
      if (s.phase !== 'question' || s.locked || out || s.question === null) return

      const index = ANSWER_KEYS[e.key.toLowerCase()] ?? ANSWER_CODES[e.code]
      if (index !== undefined) {
        if (index >= s.question.answers.length) return
        e.preventDefault()
        s.select(index)
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        submit()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [submit])

  if (!question) return null

  const isReveal = phase === 'reveal'
  const myResult = reveal?.results.find((r) => r.playerId === youId)
  const survival = settings?.survival ?? false
  const me = players.find((p) => p.id === youId)
  const eliminated = survival && me !== undefined && me.lives <= 0

  const answerState = (index: number): AnswerState => {
    if (isReveal && reveal) {
      if (index === reveal.correctIndex) return 'correcte'
      if (index === selectedAnswer) return 'fausse'
      return 'estompee'
    }
    return index === selectedAnswer ? 'choisie' : 'idle'
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center px-6">
      {/* avatars + progression */}
      {/* gap-6 : les lauriers d'un avatar de 44 px débordent de 11 px de chaque côté, il
          faut les 22 px correspondants pour que deux voisins ne se chevauchent pas */}
      <div className="relative mt-7 flex flex-wrap items-center justify-center gap-6">
        {players.map((p) => {
          const out = survival && p.lives <= 0
          return (
            <div key={p.id} className="relative">
              <Avatar
                initials={initials(p.username)}
                name={p.username}
                color={p.avatarColor}
                symbol={p.avatarSymbol}
                rank={medals[p.id] ?? null}
                size={44}
                style={{
                  opacity: !p.connected || out ? 0.4 : 1,
                  outline: p.id === youId ? '2px solid var(--color-citron)' : undefined,
                  outlineOffset: 3,
                }}
              />
              {p.answered && !isReveal && !out && (
                <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-citron text-[10px] font-bold text-ink">
                  ✓
                </span>
              )}
              {survival && (
                <span className="absolute -bottom-1.5 left-1/2 flex h-4 -translate-x-1/2 items-center rounded-full bg-ink px-1.5 text-[9px] font-semibold">
                  {out ? '💀' : `❤️${p.lives}`}
                </span>
              )}
            </div>
          )
        })}
        <div className="ml-2 flex h-11 items-center rounded-full bg-cream/8 px-4">
          <span className="text-[13px] font-semibold text-cream-soft">
            Question {question.index + 1}
            {question.total !== null && ` / ${question.total}`}
          </span>
        </div>
        {survival && me && (
          <div className="flex h-11 items-center rounded-full bg-coral/12 px-4">
            <span className="text-[13px] font-semibold text-coral">
              {eliminated ? '💀 Éliminé' : '❤️'.repeat(me.lives)}
            </span>
          </div>
        )}
      </div>

      {/* minuteur */}
      <div className="relative mt-9">
        {isReveal ? (
          <div className="flex h-24 flex-col items-center justify-center">
            {myResult ? (
              <>
                <span
                  className={`font-display text-[36px] font-semibold ${myResult.correct ? 'text-citron' : 'text-coral'}`}
                >
                  {myResult.correct ? `+${formatPoints(myResult.pointsEarned)}` : '+0'}
                </span>
                <span className="text-[13px] text-muted">
                  {myResult.correct
                    ? 'Bonne réponse !'
                    : (myResult.answerIndex === null ? 'Pas de réponse' : 'Mauvaise réponse') +
                      (survival ? ` — ${myResult.lives > 0 ? '−1 vie ❤️' : 'éliminé 💀'}` : '')}
                </span>
              </>
            ) : (
              eliminated && (
                <span className="font-display text-2xl font-semibold text-muted">
                  💀 Tu regardes la fin de la partie
                </span>
              )
            )}
          </div>
        ) : (
          questionStartedAt && <Timer duration={question.duration} startedAt={questionStartedAt} />
        )}
      </div>

      {/* thème du quiz d'origine (modes Aléatoire/Survie) — contexte de la question */}
      {question.theme && (
        <div className="relative mt-6 flex h-9 max-w-[calc(100vw-3rem)] items-center rounded-full bg-violet/16 px-4 sm:mt-8">
          <span className="truncate text-[13px] font-semibold uppercase tracking-[1.5px] text-violet">
            🎯 {question.theme}
          </span>
        </div>
      )}

      <h1
        className={`relative max-w-[760px] text-center font-display text-[24px] font-semibold leading-[1.2] text-cream sm:text-[28px] md:text-[40px] ${
          question.theme ? 'mt-3.5' : 'mt-7 sm:mt-9'
        }`}
      >
        {question.text}
      </h1>

      {/* réponses */}
      <div className="relative mt-7 grid w-full max-w-[760px] grid-cols-1 gap-3 sm:mt-10 sm:gap-[18px] md:grid-cols-2">
        {question.answers.map((answer, i) => (
          <AnswerCard
            key={i}
            letter={LETTERS[i]}
            state={answerState(i)}
            disabled={locked || isReveal || eliminated}
            onClick={() => select(i)}
          >
            {answer}
          </AnswerCard>
        ))}
      </div>

      {/* validation */}
      <div className="relative mb-16 mt-9 flex w-full max-w-[760px] items-center gap-4">
        <span className="flex-1 text-[13px] text-muted">
          {isReveal
            ? 'La question suivante arrive…'
            : eliminated
              ? 'Tu es éliminé — la partie continue sans toi, reste pour voir qui survit !'
              : locked
                ? 'Réponse envoyée — en attente des autres joueurs.'
                : selectedAnswer !== null
                  ? 'Validée automatiquement à la fin du temps si tu ne cliques pas.'
                  : 'Réponse enregistrée dès validation.'}
        </span>
        {!isReveal && !eliminated && (
          <span className="hidden flex-none items-center gap-1.5 text-[13px] text-muted lg:flex">
            {LETTERS.slice(0, question.answers.length).map((l) => (
              <KeyHint key={l}>{l}</KeyHint>
            ))}
            <span className="mx-1">puis</span>
            <KeyHint tone="citron">Entrée</KeyHint>
          </span>
        )}
        {!isReveal && !eliminated && (
          <Button
            variant="contour"
            disabled={selectedAnswer === null || locked}
            onClick={submit}
          >
            Valider →
          </Button>
        )}
      </div>
    </div>
  )
}
