import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { GlowBackdrop, HOME_GLOWS } from '../components/GlowBackdrop'
import { NavPill } from '../components/NavPill'
import { PillButton } from '../components/PillButton'
import { api } from '../lib/api'
import type { QuizSummary } from '../lib/types'
import { formatPlays } from '../lib/utils'

const ACCENTS = ['#C7F45C', '#9C8DF2', '#F0492E']

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
      <GlowBackdrop glows={HOME_GLOWS} />
      <NavPill />

      <div className="relative mx-auto max-w-[760px] pb-24 pt-14">
        <div className="mb-8 flex items-center gap-4">
          <h1 className="font-display text-[38px] font-semibold text-cream">Mes quiz</h1>
          <div className="flex-1" />
          <PillButton onClick={() => navigate('/quiz/new')}>+ Créer un quiz</PillButton>
        </div>

        {quizzes === null ? (
          <div className="rounded-[28px] bg-card p-10 text-center text-muted">Chargement…</div>
        ) : quizzes.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-[28px] bg-card p-12 text-center">
            <span className="text-4xl">✨</span>
            <p className="text-muted">
              Tu n'as pas encore de quiz. Crée ton premier quiz et défie tes amis !
            </p>
            <PillButton onClick={() => navigate('/quiz/new')}>Créer mon premier quiz</PillButton>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {quizzes.map((quiz, i) => (
              <div key={quiz.id} className="flex items-center gap-4 rounded-[28px] bg-card p-5">
                <div
                  className="flex h-12 w-12 flex-none items-center justify-center rounded-2xl text-2xl"
                  style={{ background: ACCENTS[i % ACCENTS.length] }}
                >
                  {quiz.emoji}
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate font-display text-[17px] font-semibold text-cream">
                    {quiz.title}
                  </span>
                  <span className="text-[13px] text-muted">
                    {quiz.category} · {quiz.questionCount} question
                    {quiz.questionCount > 1 ? 's' : ''} · {formatPlays(quiz.playCount)} partie
                    {quiz.playCount > 1 ? 's' : ''}
                  </span>
                </div>
                <PillButton size="sm" disabled={busyId === quiz.id} onClick={() => play(quiz)}>
                  Jouer ▶
                </PillButton>
                <PillButton size="sm" variant="outline" onClick={() => navigate(`/quiz/${quiz.id}/edit`)}>
                  Éditer
                </PillButton>
                <PillButton size="sm" variant="coral-ghost" onClick={() => remove(quiz)}>
                  Supprimer
                </PillButton>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
