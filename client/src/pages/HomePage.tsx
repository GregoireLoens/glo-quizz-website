import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { GlowBackdrop, HOME_GLOWS } from '../components/GlowBackdrop'
import { NavPill } from '../components/NavPill'
import { PillButton } from '../components/PillButton'
import { QuizCard } from '../components/QuizCard'
import { api } from '../lib/api'
import type { QuizSummary } from '../lib/types'
import { useAuthStore } from '../stores/authStore'

export function HomePage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const [quizzes, setQuizzes] = useState<QuizSummary[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [category, setCategory] = useState<string | null>(null)
  const [busyQuizId, setBusyQuizId] = useState<number | null>(null)

  useEffect(() => {
    api.get<string[]>('/api/categories').then(setCategories).catch(() => {})
  }, [])

  useEffect(() => {
    const params = new URLSearchParams({ limit: '12', sort: 'popular' })
    if (category) params.set('category', category)
    api.get<QuizSummary[]>(`/api/quizzes?${params}`).then(setQuizzes).catch(() => {})
  }, [category])

  const playQuiz = async (quiz: QuizSummary) => {
    if (!user) {
      navigate('/login', { state: { from: '/' } })
      return
    }
    setBusyQuizId(quiz.id)
    try {
      const res = await api.post<{ code: string }>('/api/games', { quizId: quiz.id })
      navigate(`/game/${res.code}`)
    } finally {
      setBusyQuizId(null)
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden px-6">
      <GlowBackdrop glows={HOME_GLOWS} />
      <NavPill />

      {/* hero */}
      <div className="relative mx-auto max-w-[1080px] pt-[100px]">
        <div className="mb-[22px] inline-flex h-[30px] items-center gap-2 rounded-full bg-citron/14 px-3.5">
          <span className="h-1.5 w-1.5 rounded-full bg-citron" />
          <span className="text-xs font-semibold uppercase tracking-[1.5px] text-citron">
            Quiz multijoueur
          </span>
        </div>
        <h1 className="max-w-[820px] font-display text-[52px] font-semibold leading-[1.02] tracking-[-1px] text-cream md:text-[76px]">
          Crée des quizz.
          <br />
          Défie tes potes
          <br />
          en direct.
        </h1>
        <p className="mt-[26px] max-w-[460px] text-lg leading-[27px] text-muted-soft">
          Compose un quiz en quelques minutes, partage un code, et joue avec tes amis en temps réel
          — où qu'ils soient.
        </p>
        <div className="mt-8 flex flex-wrap gap-3.5">
          <PillButton size="lg" onClick={() => navigate(user ? '/quiz/new' : '/register')}>
            Créer un quiz
            <span className="text-lg">↗</span>
          </PillButton>
          <PillButton size="lg" variant="outline" onClick={() => navigate('/join')}>
            Rejoindre une partie
          </PillButton>
        </div>
      </div>

      {/* quiz populaires */}
      <div className="relative mx-auto max-w-[1080px] pb-[100px] pt-24">
        <div className="mb-6 flex items-baseline gap-3">
          <span className="font-display text-[26px] font-semibold text-cream">Quizz populaires</span>
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => navigate(user ? '/quiz/new' : '/register')}
            className="cursor-pointer text-sm font-semibold text-citron hover:underline"
          >
            Créer le tien ↗
          </button>
        </div>

        {quizzes.length === 0 ? (
          <div className="rounded-[28px] bg-card p-10 text-center text-muted">
            Aucun quiz pour l'instant — sois le premier à en créer un !
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {quizzes.map((quiz, i) => (
              <QuizCard
                key={quiz.id}
                quiz={quiz}
                index={i}
                busy={busyQuizId === quiz.id}
                onPlay={() => playQuiz(quiz)}
              />
            ))}
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={() => setCategory(null)}
            className={`flex h-9 cursor-pointer items-center rounded-full px-[18px] text-[13.5px] transition ${
              category === null
                ? 'bg-cream font-semibold text-ink'
                : 'border border-cream/25 text-cream-soft hover:border-cream/50'
            }`}
          >
            Tous
          </button>
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={`flex h-9 cursor-pointer items-center rounded-full px-[18px] text-[13.5px] transition ${
                category === c
                  ? 'bg-cream font-semibold text-ink'
                  : 'border border-cream/25 text-cream-soft hover:border-cream/50'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
