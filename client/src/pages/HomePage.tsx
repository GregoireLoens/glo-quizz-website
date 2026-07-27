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
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [busyQuizId, setBusyQuizId] = useState<number | null>(null)
  const [busyRandom, setBusyRandom] = useState(false)

  useEffect(() => {
    api.get<string[]>('/api/categories').then(setCategories).catch(() => {})
  }, [])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 250)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    const params = new URLSearchParams({ limit: debouncedSearch ? '50' : '12', sort: 'popular' })
    if (category) params.set('category', category)
    if (debouncedSearch) params.set('search', debouncedSearch)
    api.get<QuizSummary[]>(`/api/quizzes?${params}`).then(setQuizzes).catch(() => {})
  }, [category, debouncedSearch])

  const playRandom = async () => {
    if (!user) {
      navigate('/login', { state: { from: '/' } })
      return
    }
    setBusyRandom(true)
    try {
      const res = await api.post<{ code: string }>('/api/games', { random: true })
      navigate(`/game/${res.code}`)
    } finally {
      setBusyRandom(false)
    }
  }

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
      <div className="relative mx-auto max-w-[1080px] pt-16 md:pt-[100px]">
        <div className="mb-[22px] inline-flex h-[30px] items-center gap-2 rounded-full bg-citron/14 px-3.5">
          <span className="h-1.5 w-1.5 rounded-full bg-citron" />
          <span className="text-xs font-semibold uppercase tracking-[1.5px] text-citron">
            Quiz multijoueur
          </span>
        </div>
        <h1 className="max-w-[820px] font-display text-[42px] font-semibold leading-[1.02] tracking-[-1px] text-cream sm:text-[52px] md:text-[76px]">
          Lance un quizz.
          <br />
          Défie tes potes
          <br />
          en direct.
        </h1>
        <p className="mt-[26px] max-w-[460px] text-base leading-[25px] text-muted-soft md:text-lg md:leading-[27px]">
          Choisis un quiz, partage un code, et joue avec tes amis en temps réel — où qu'ils
          soient.
        </p>
        <div className="mt-8 flex flex-col gap-3.5 sm:flex-row sm:flex-wrap">
          <PillButton size="lg" onClick={() => navigate('/join')}>
            Rejoindre une partie
            <span className="text-lg">↗</span>
          </PillButton>
          <PillButton
            size="lg"
            variant="outline"
            className="border-violet/50 text-violet hover:bg-violet/10"
            disabled={busyRandom}
            onClick={playRandom}
          >
            Partie aléatoire
            <span className="text-lg">🎲</span>
          </PillButton>
        </div>
      </div>

      {/* quiz populaires */}
      <div className="relative mx-auto max-w-[1080px] pb-16 pt-16 md:pt-24">
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <span className="font-display text-[26px] font-semibold text-cream">Quizz populaires</span>
          <div className="relative w-full sm:w-[300px]">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-muted">
              🔍
            </span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Chercher un thème…"
              className="h-11 w-full rounded-full border-[1.5px] border-cream/15 bg-card pl-11 pr-5 text-sm font-medium text-cream outline-none transition placeholder:text-muted-deep focus:border-citron/60"
            />
          </div>
        </div>

        <div className="mb-6 flex flex-wrap gap-2.5">
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

        {quizzes.length === 0 ? (
          <div className="rounded-[28px] bg-card p-10 text-center text-muted">
            {debouncedSearch || category
              ? 'Aucun quiz ne correspond à ta recherche.'
              : "Aucun quiz pour l'instant — reviens bientôt !"}
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
      </div>

      <footer className="relative mx-auto max-w-[1080px] border-t border-cream/10 pb-10 pt-6 text-[13px] leading-relaxed text-muted">
        Les quiz signés « OpenQuizzDB » proviennent d'
        <a
          href="https://www.openquizzdb.org"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-cream"
        >
          OpenQuizzDB
        </a>{' '}
        et sont réutilisés sous licence{' '}
        <a
          href="https://creativecommons.org/licenses/by-sa/4.0/deed.fr"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-cream"
        >
          CC BY-SA 4.0
        </a>
        .
      </footer>
    </div>
  )
}
