import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { GlowBackdrop, AUTH_GLOWS } from '../components/GlowBackdrop'
import { NavPill } from '../components/NavPill'
import { PillButton } from '../components/PillButton'
import { api } from '../lib/api'
import type { QuestionInput, QuizDetail } from '../lib/types'

const EMOJIS = ['🌍', '🔬', '🎬', '🎵', '⚽', '🧠', '📚', '🎨', '🎯', '🍿', '💡', '🕹️']
const LETTERS = ['A', 'B', 'C', 'D']

const emptyQuestion = (): QuestionInput => ({ text: '', answers: ['', '', '', ''], correctIndex: 0 })

export function QuizEditorPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const editing = id !== undefined

  const [title, setTitle] = useState('')
  const [emoji, setEmoji] = useState('🎯')
  const [category, setCategory] = useState<string | null>(null)
  const [categories, setCategories] = useState<string[]>([])
  const [questions, setQuestions] = useState<QuestionInput[]>([emptyQuestion()])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [loaded, setLoaded] = useState(!editing)

  useEffect(() => {
    api.get<string[]>('/api/categories').then(setCategories).catch(() => {})
  }, [])

  useEffect(() => {
    if (!editing) return
    api
      .get<QuizDetail>(`/api/quizzes/${id}`)
      .then((quiz) => {
        setTitle(quiz.title)
        setEmoji(quiz.emoji)
        setCategory(quiz.category)
        setQuestions(quiz.questions.length > 0 ? quiz.questions : [emptyQuestion()])
        setLoaded(true)
      })
      .catch(() => navigate('/quizzes/mine'))
  }, [editing, id, navigate])

  const patchQuestion = (index: number, patch: Partial<QuestionInput>) => {
    setQuestions((qs) => qs.map((q, i) => (i === index ? { ...q, ...patch } : q)))
  }

  const patchAnswer = (qIndex: number, aIndex: number, value: string) => {
    setQuestions((qs) =>
      qs.map((q, i) =>
        i === qIndex ? { ...q, answers: q.answers.map((a, j) => (j === aIndex ? value : a)) } : q,
      ),
    )
  }

  const validate = (): string | null => {
    if (title.trim().length === 0) return 'Donne un titre à ton quiz.'
    if (!category) return 'Choisis une catégorie.'
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i]
      if (q.text.trim().length === 0) return `La question ${i + 1} est vide.`
      if (q.answers.some((a) => a.trim().length === 0))
        return `Les 4 réponses de la question ${i + 1} doivent être remplies.`
    }
    return null
  }

  const save = async () => {
    const problem = validate()
    if (problem) {
      setError(problem)
      return
    }
    setError(null)
    setSaving(true)
    try {
      const payload = { title: title.trim(), emoji, category, questions }
      if (editing) {
        await api.put(`/api/quizzes/${id}`, payload)
      } else {
        await api.post('/api/quizzes', payload)
      }
      navigate('/quizzes/mine')
    } catch {
      setError("L'enregistrement a échoué. Vérifie le contenu et réessaie.")
    } finally {
      setSaving(false)
    }
  }

  if (!loaded) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted">Chargement…</div>
    )
  }

  return (
    <div className="relative min-h-screen overflow-hidden px-6">
      <GlowBackdrop glows={AUTH_GLOWS} />
      <NavPill />

      <div className="relative mx-auto max-w-[760px] pb-32 pt-14">
        <h1 className="mb-8 font-display text-[38px] font-semibold text-cream">
          {editing ? 'Modifier le quiz' : 'Crée ton quiz'}
        </h1>

        {/* infos générales */}
        <div className="flex flex-col gap-6 rounded-[28px] bg-card p-7">
          <div className="flex flex-col gap-2">
            <span className="text-[12.5px] font-semibold text-muted">Titre</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Capitales du monde"
              maxLength={80}
              className="h-14 w-full rounded-full border-[1.5px] border-cream/15 bg-ink px-6 text-base font-medium text-cream outline-none transition placeholder:text-muted-deep focus:border-citron/60"
            />
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-[12.5px] font-semibold text-muted">Emoji</span>
            <div className="flex flex-wrap gap-2">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setEmoji(e)}
                  className={`flex h-11 w-11 cursor-pointer items-center justify-center rounded-2xl text-xl transition ${
                    emoji === e ? 'bg-citron' : 'bg-ink hover:bg-cream/10'
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-[12.5px] font-semibold text-muted">Catégorie</span>
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  className={`flex h-9 cursor-pointer items-center rounded-full px-4 text-[13.5px] transition ${
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

        {/* questions */}
        {questions.map((q, qi) => (
          <div key={qi} className="mt-6 flex flex-col gap-5 rounded-[28px] bg-card p-7">
            <div className="flex items-center gap-3">
              <span className="flex h-8 items-center rounded-full bg-citron/14 px-3.5 text-[13px] font-semibold text-citron">
                Question {qi + 1}
              </span>
              <div className="flex-1" />
              {questions.length > 1 && (
                <button
                  type="button"
                  onClick={() => setQuestions((qs) => qs.filter((_, i) => i !== qi))}
                  className="cursor-pointer text-[13px] font-semibold text-coral hover:underline"
                >
                  Supprimer
                </button>
              )}
            </div>

            <input
              value={q.text}
              onChange={(e) => patchQuestion(qi, { text: e.target.value })}
              placeholder="Quelle est la capitale de l'Australie ?"
              maxLength={300}
              className="h-14 w-full rounded-full border-[1.5px] border-cream/15 bg-ink px-6 text-base font-medium text-cream outline-none transition placeholder:text-muted-deep focus:border-citron/60"
            />

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {q.answers.map((answer, ai) => {
                const correct = q.correctIndex === ai
                return (
                  <div
                    key={ai}
                    className={`flex items-center gap-3 rounded-full border-[1.5px] py-1.5 pl-1.5 pr-4 transition ${
                      correct ? 'border-citron bg-citron/10' : 'border-cream/15 bg-ink'
                    }`}
                  >
                    <button
                      type="button"
                      title="Marquer comme bonne réponse"
                      onClick={() => patchQuestion(qi, { correctIndex: ai })}
                      className={`flex h-9 w-9 flex-none cursor-pointer items-center justify-center rounded-full text-sm font-semibold transition ${
                        correct ? 'bg-citron text-ink' : 'bg-cream/10 text-cream hover:bg-cream/20'
                      }`}
                    >
                      {correct ? '✓' : LETTERS[ai]}
                    </button>
                    <input
                      value={answer}
                      onChange={(e) => patchAnswer(qi, ai, e.target.value)}
                      placeholder={`Réponse ${LETTERS[ai]}`}
                      maxLength={120}
                      className="w-full bg-transparent text-sm font-medium text-cream outline-none placeholder:text-muted-deep"
                    />
                  </div>
                )
              })}
            </div>
            <span className="text-xs text-muted-deep">
              Clique sur la lettre pour marquer la bonne réponse.
            </span>
          </div>
        ))}

        <button
          type="button"
          onClick={() => setQuestions((qs) => [...qs, emptyQuestion()])}
          className="mt-6 flex h-14 w-full cursor-pointer items-center justify-center rounded-full border-[2px] border-dashed border-cream/20 text-[15px] font-semibold text-muted transition hover:border-cream/40 hover:text-cream"
        >
          + Ajouter une question
        </button>

        {/* barre d'action */}
        <div className="sticky bottom-6 mt-8 flex items-center gap-4 rounded-full border border-cream/10 bg-card px-6 py-3">
          <span className="flex-1 text-[13px] text-muted">
            {questions.length} question{questions.length > 1 ? 's' : ''}
            {error && <span className="ml-3 font-medium text-coral">{error}</span>}
          </span>
          <PillButton variant="ghost" onClick={() => navigate(-1)}>
            Annuler
          </PillButton>
          <PillButton onClick={save} disabled={saving}>
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </PillButton>
        </div>
      </div>
    </div>
  )
}
