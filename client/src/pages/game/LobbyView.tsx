import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Avatar } from '../../components/Avatar'
import { PillButton } from '../../components/PillButton'
import { PlayerBubble } from '../../components/PlayerBubble'
import { SegmentedControl } from '../../components/SegmentedControl'
import { api } from '../../lib/api'
import type { QuizSummary } from '../../lib/types'
import { gameSocket } from '../../lib/ws'
import { useAuthStore } from '../../stores/authStore'
import { useGameStore } from '../../stores/gameStore'

const QUESTION_CHOICES = [5, 10, 15, 20]
const TIME_CHOICES = [15, 30, 60]

function QuizPicker({ onClose }: { onClose: () => void }) {
  const [quizzes, setQuizzes] = useState<QuizSummary[]>([])
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    Promise.all([
      api.get<QuizSummary[]>('/api/quizzes/mine').catch(() => [] as QuizSummary[]),
      api.get<QuizSummary[]>('/api/quizzes?limit=20').catch(() => [] as QuizSummary[]),
    ]).then(([mine, popular]) => {
      const seen = new Set<number>()
      const merged = [...mine, ...popular].filter((q) => {
        if (seen.has(q.id)) return false
        seen.add(q.id)
        return true
      })
      setQuizzes(merged)
    })
  }, [])

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [onClose])

  return (
    <div
      ref={ref}
      className="absolute left-0 top-11 z-20 flex max-h-72 w-80 flex-col gap-1 overflow-y-auto rounded-3xl border border-cream/10 bg-ink p-2"
    >
      {quizzes.length === 0 && (
        <span className="px-4 py-3 text-sm text-muted">Aucun quiz disponible — crée-en un !</span>
      )}
      {quizzes.map((q) => (
        <button
          key={q.id}
          type="button"
          onClick={() => {
            gameSocket.send({ type: 'update_settings', settings: { quizId: q.id } })
            onClose()
          }}
          className="flex cursor-pointer items-center gap-3 rounded-2xl px-3 py-2.5 text-left hover:bg-cream/5"
        >
          <span className="text-xl">{q.emoji}</span>
          <span className="flex-1 truncate text-sm font-medium text-cream">{q.title}</span>
          <span className="text-xs text-muted">{q.questionCount} q.</span>
        </button>
      ))}
    </div>
  )
}

export function LobbyView() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const { code, youId, hostId, players, settings, errorMsg, clearError } = useGameStore()
  const [copied, setCopied] = useState<'code' | 'link' | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)

  const isHost = youId !== null && youId === hostId
  const you = players.find((p) => p.id === youId)
  const shareUrl = `${location.origin}/game/${code}`

  const copy = async (text: string, kind: 'code' | 'link') => {
    if (navigator.share && kind === 'link') {
      try {
        await navigator.share({ title: 'midi quizz', text: 'Rejoins ma partie !', url: text })
        return
      } catch {
        // partage annulé → fallback presse-papiers
      }
    }
    await navigator.clipboard.writeText(text)
    setCopied(kind)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center px-6">
      {/* barre haute */}
      <nav className="relative z-10 mt-6 flex h-16 w-full max-w-[1080px] items-center gap-4 rounded-[32px] border border-white/12 bg-white/6 pl-[26px] pr-2.5">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="cursor-pointer text-xl text-cream transition hover:-translate-x-0.5"
          title="Quitter le salon"
        >
          ←
        </button>
        <span className="font-display text-lg font-semibold text-cream">Salon multijoueur</span>
        <div className="flex h-8 items-center gap-1.5 rounded-full bg-citron/14 px-3">
          <span className="h-1.5 w-1.5 rounded-full bg-citron" />
          <span className="text-xs font-semibold text-citron">En attente</span>
        </div>
        <div className="flex-1" />
        {user && <Avatar name={user.username} size={44} />}
      </nav>

      {/* code de la partie */}
      <div className="relative mt-14 flex flex-col items-center gap-2.5">
        <span className="text-xs font-semibold uppercase tracking-[2px] text-muted">
          Code de la partie
        </span>
        <span className="font-display text-[56px] font-semibold tracking-[10px] text-cream md:text-[88px] md:tracking-[14px]">
          {code}
        </span>
        <div className="mt-2.5 flex gap-3">
          <PillButton onClick={() => copy(code ?? '', 'code')}>
            {copied === 'code' ? 'Copié ✓' : 'Copier le code'}
          </PillButton>
          <PillButton variant="outline" onClick={() => copy(shareUrl, 'link')}>
            {copied === 'link' ? 'Lien copié ✓' : 'Partager le lien'}
          </PillButton>
        </div>
      </div>

      {/* joueurs */}
      <div className="relative mt-14 flex flex-wrap justify-center gap-5">
        {players.map((p) => (
          <PlayerBubble
            key={p.id}
            name={p.username}
            subtitle={p.id === hostId ? 'Hôte' : p.ready ? 'Prêt' : 'En attente…'}
            ready={p.id === hostId || p.ready}
            pending={!p.connected}
          />
        ))}
        <button
          type="button"
          onClick={() => copy(shareUrl, 'link')}
          className="flex cursor-pointer flex-col items-center gap-2"
        >
          <div className="flex h-[76px] w-[76px] items-center justify-center rounded-full border-[3px] border-dashed border-cream/20 text-[22px] text-cream/30 transition hover:border-cream/40 hover:text-cream/60">
            +
          </div>
          <span className="text-[13px] text-muted">Inviter</span>
        </button>
      </div>

      {/* réglages */}
      <div className="relative mt-14 flex flex-wrap items-center justify-center gap-3.5 rounded-[28px] bg-card px-5 py-3.5">
        <span className="text-[13px] text-muted">Questions</span>
        {isHost ? (
          <SegmentedControl
            options={QUESTION_CHOICES.map((n) => ({ label: String(n), value: n }))}
            value={settings?.questionCount ?? 10}
            onChange={(v) => gameSocket.send({ type: 'update_settings', settings: { questionCount: v } })}
          />
        ) : (
          <div className="flex h-[34px] items-center rounded-full bg-cream/8 px-3.5 text-[13.5px] font-semibold text-cream">
            {settings?.questionCount ?? 10}
          </div>
        )}

        <div className="h-6 w-px bg-cream/15" />

        <span className="text-[13px] text-muted">Temps</span>
        {isHost ? (
          <SegmentedControl
            options={TIME_CHOICES.map((n) => ({ label: `${n}s`, value: n }))}
            value={settings?.timePerQuestion ?? 30}
            onChange={(v) =>
              gameSocket.send({ type: 'update_settings', settings: { timePerQuestion: v } })
            }
          />
        ) : (
          <div className="flex h-[34px] items-center rounded-full bg-citron px-3.5 text-[13px] font-semibold text-ink">
            {settings?.timePerQuestion ?? 30}s
          </div>
        )}

        <div className="h-6 w-px bg-cream/15" />

        <span className="text-[13px] text-muted">Quiz</span>
        <div className="relative">
          <button
            type="button"
            disabled={!isHost}
            onClick={() => setPickerOpen((v) => !v)}
            className={`flex h-[34px] items-center gap-2 rounded-full bg-cream/8 px-3.5 text-[13.5px] font-semibold text-cream ${
              isHost ? 'cursor-pointer hover:bg-cream/15' : ''
            }`}
          >
            {settings?.quizTitle ?? 'Choisir un quiz'}
            {isHost && <span className="text-[10px] text-muted">▼</span>}
          </button>
          {pickerOpen && <QuizPicker onClose={() => setPickerOpen(false)} />}
        </div>
      </div>

      {errorMsg && (
        <button
          type="button"
          onClick={clearError}
          className="relative mt-5 cursor-pointer rounded-2xl bg-coral/12 px-4.5 py-3 text-[13px] text-coral-soft"
        >
          {errorMsg} — cliquer pour fermer
        </button>
      )}

      {/* action principale */}
      <div className="relative mb-16 mt-10">
        {isHost ? (
          <PillButton
            size="lg"
            className="px-10"
            disabled={!settings?.quizId || players.length < 1}
            onClick={() => gameSocket.send({ type: 'start' })}
          >
            Lancer la partie
            <span className="text-xl">▶</span>
          </PillButton>
        ) : (
          <PillButton
            size="lg"
            variant={you?.ready ? 'outline' : 'citron'}
            className="px-10"
            onClick={() => gameSocket.send({ type: 'ready', ready: !you?.ready })}
          >
            {you?.ready ? 'Je ne suis plus prêt' : 'Je suis prêt !'}
          </PillButton>
        )}
      </div>
    </div>
  )
}
