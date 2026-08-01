import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Button } from '../components/Button'
import { GlowBackdrop } from '../components/GlowBackdrop'
import { NavBar } from '../components/NavBar'
import { api } from '../lib/api'
import type { QuizSummary } from '../lib/types'
import { formatPlays } from '../lib/utils'

const ACCENTS = ['var(--color-citron)', 'var(--color-violet)', 'var(--color-coral)']

export function MyQuizzesPage() {
  const navigate = useNavigate()
  const [quizzes, setQuizzes] = useState<QuizSummary[] | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)

  const load = () => {
    api.get<QuizSummary[]>('/api/quizzes/mine').then(setQuizzes).catch(() => setQuizzes([]))
  }
  useEffect(load, [])

  const play = async (quiz: QuizSummary) => {
    setBusyId(quiz.id)
    try {
      const res = await api.post<{ code: string }>('/api/games', { quizId: quiz.id })
      navigate(`/game/${res.code}`)
    } finally {
      setBusyId(null)
    }
  }

  const remove = async (quiz: QuizSummary) => {
    if (!window.confirm(`Supprimer « ${quiz.title} » ? Cette action est définitive.`)) return
    await api.delete(`/api/quizzes/${quiz.id}`)
    load()
  }

  return (
    <div className="relative min-h-screen overflow-hidden px-6">
      <GlowBackdrop color="var(--color-citron)" x="28%" y="-6%" size={640} opacity={0.14} />
      <NavBar />

      <div className="relative mx-auto max-w-[760px] pb-24 pt-14">
        <div className="mb-8 flex items-center gap-4">
          <h1 className="font-display text-[30px] font-semibold text-cream sm:text-[38px]">
            Mes quiz
          </h1>
        </div>

        {quizzes === null ? (
          <div className="rounded-xl border border-line bg-card p-10 text-center text-muted">Chargement…</div>
        ) : quizzes.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-xl border border-line bg-card p-12 text-center">
            <span className="text-4xl">✨</span>
            <p className="text-muted">Tu n'as pas de quiz pour l'instant.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {quizzes.map((quiz, i) => (
              <div
                key={quiz.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-xl border border-line bg-card p-5"
              >
                <div
                  className="flex h-12 w-12 flex-none items-center justify-center rounded-md text-[24px]"
                  style={{ background: `color-mix(in oklab, ${ACCENTS[i % ACCENTS.length]} 15%, transparent)` }}
                >
                  {quiz.emoji}
                </div>
                <div className="flex min-w-0 flex-1 basis-44 flex-col gap-0.5">
                  <span className="truncate font-display text-[17px] font-semibold text-cream">
                    {quiz.title}
                  </span>
                  <span className="text-sm text-muted">
                    {quiz.category} · {quiz.questionCount} question
                    {quiz.questionCount > 1 ? 's' : ''} · {formatPlays(quiz.playCount)} partie
                    {quiz.playCount > 1 ? 's' : ''}
                  </span>
                </div>
                <div className="flex w-full flex-wrap justify-end gap-2 sm:w-auto">
                  <Button size="compact" disabled={busyId === quiz.id} onClick={() => play(quiz)}>
                    Jouer ▶
                  </Button>
                  <Button size="compact" variant="contour" onClick={() => navigate(`/quiz/${quiz.id}/edit`)}>
                    Éditer
                  </Button>
                  <Button size="compact" variant="coral" onClick={() => remove(quiz)}>
                    Supprimer
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
