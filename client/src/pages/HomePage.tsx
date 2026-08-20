import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Button } from '../components/Button'
import { Chip } from '../components/Chip'
import { GlowBackdrop } from '../components/GlowBackdrop'
import { Icon } from '../components/Icon'
import { NavBar } from '../components/NavBar'
import { QuizCard } from '../components/QuizCard'
import { api } from '../lib/api'
import type { QuizSummary } from '../lib/types'
import { APP_VERSION } from '../lib/version'
import { formatPlays, initials } from '../lib/utils'
import { useMedals } from '../stores/leadersStore'
import { useAuthStore } from '../stores/authStore'

const ACCENTS = ['var(--color-citron)', 'var(--color-violet)', 'var(--color-coral)']

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
  const medals = useMedals()

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
      <GlowBackdrop color="var(--color-citron)" x="28%" y="-6%" size={640} opacity={0.14} />
      <NavBar />

      {/* hero */}
      <div className="relative mx-auto max-w-[1080px] pt-16 md:pt-[100px]">
        <div className="mb-[22px] inline-flex h-[30px] items-center gap-2 rounded-full bg-citron/14 px-3.5">
          <span className="h-1.5 w-1.5 rounded-full bg-citron" />
          <span className="text-xs font-semibold uppercase tracking-[1.5px] text-citron">
            Quiz multijoueur
          </span>
        </div>
        <h1 className="max-w-[820px] font-display text-4xl font-semibold leading-[1.02] tracking-[-1px] text-cream md:text-[76px]">
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
          <Button size="hero" iconRight="↗" onClick={() => navigate('/join')}>
            Rejoindre une partie
          </Button>
          <Button
            size="hero"
            variant="contour"
            className="border-violet/50 text-violet hover:bg-violet/10"
            disabled={busyRandom}
            onClick={playRandom}
            iconRight="🎲"
          >
            Partie aléatoire
          </Button>
        </div>
      </div>

      {/* quiz populaires */}
      <div className="relative mx-auto max-w-[1080px] pb-16 pt-16 md:pt-24">
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <span className="font-display text-2xl font-semibold text-cream">Quizz populaires</span>
          <div className="relative w-full sm:w-[300px]">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted">
              <Icon name="chercher" size={16} />
            </span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Chercher un thème…"
              className="h-11 w-full rounded-full border-[1.5px] border-line-strong bg-ink-2 pl-11 pr-5 text-sm font-medium text-cream outline-none transition placeholder:text-muted-deep focus:border-citron/60"
            />
          </div>
        </div>

        <div className="mb-6 flex flex-wrap gap-2.5">
          <Chip active={category === null} onClick={() => setCategory(null)}>
            Tous
          </Chip>
          {categories.map((c) => (
            <Chip key={c} active={category === c} onClick={() => setCategory(c)}>
              {c}
            </Chip>
          ))}
        </div>

        {quizzes.length === 0 ? (
          <div className="rounded-xl border border-line bg-card p-10 text-center text-muted">
            {debouncedSearch || category
              ? 'Aucun quiz ne correspond à ta recherche.'
              : "Aucun quiz pour l'instant — reviens bientôt !"}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {quizzes.map((quiz, i) => (
              <QuizCard
                key={quiz.id}
                emoji={quiz.emoji}
                category={quiz.category}
                title={quiz.title}
                // « 0 partie » sur chaque carte d'un catalogue neuf n'informe de rien et
                // fait vide : le compteur n'apparaît qu'une fois la première partie jouée.
                meta={
                  `${quiz.questionCount} question${quiz.questionCount > 1 ? 's' : ''}` +
                  (quiz.playCount > 0
                    ? ` · ${formatPlays(quiz.playCount)} partie${quiz.playCount > 1 ? 's' : ''}`
                    : '')
                }
                author={quiz.author.username}
                initials={initials(quiz.author.username)}
                authorColor={quiz.author.avatarColor}
                authorSymbol={quiz.author.avatarSymbol}
                authorRank={medals[quiz.author.id] ?? null}
                accent={ACCENTS[i % ACCENTS.length]}
                action={
                  <Button
                    size="compact"
                    disabled={busyQuizId === quiz.id}
                    onClick={() => playQuiz(quiz)}
                    icon={<Icon name="jouer" size={14} />}
                  >
                    Jouer
                  </Button>
                }
              />
            ))}
          </div>
        )}
      </div>

      <footer className="relative mx-auto flex max-w-[1080px] flex-col gap-3 border-t border-line pb-10 pt-6 text-sm leading-relaxed text-muted sm:flex-row sm:items-end sm:justify-between sm:gap-8">
        <p>
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
        </p>
        <span className="flex-none whitespace-nowrap font-medium text-muted-deep">
          Midi Quizz v{APP_VERSION}
        </span>
      </footer>
    </div>
  )
}
