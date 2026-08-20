import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Button } from '../../components/Button'
import { Card } from '../../components/Card'
import { Chip } from '../../components/Chip'
import { Icon } from '../../components/Icon'
import { NavBar } from '../../components/NavBar'
import { PlayerBubble } from '../../components/PlayerBubble'
import { SegmentedControl } from '../../components/SegmentedControl'
import { SettingRow } from '../../components/SettingRow'
import { SurvivalBadge } from '../../components/SurvivalBadge'
import { api } from '../../lib/api'
import type { QuizSummary } from '../../lib/types'
import { initials } from '../../lib/utils'
import { gameSocket } from '../../lib/ws'
import { useAuthStore } from '../../stores/authStore'
import { useGameStore } from '../../stores/gameStore'
import { useMedals } from '../../stores/leadersStore'

const QUESTION_CHOICES = [5, 10, 15, 20]
const TIME_CHOICES = [15, 30, 60]

function QuizPicker({ onClose }: { onClose: () => void }) {
  const [quizzes, setQuizzes] = useState<QuizSummary[]>([])
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Le catalogue appartient au site : personne n'a de quiz à soi à faire remonter ici.
    api
      .get<QuizSummary[]>('/api/quizzes?limit=20')
      .then(setQuizzes)
      .catch(() => setQuizzes([]))
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
      className="absolute right-0 top-11 z-20 flex max-h-72 w-72 max-w-[calc(100vw-3rem)] flex-col gap-1 overflow-y-auto rounded-xl border border-line bg-ink p-2 sm:w-80"
    >
      <button
        type="button"
        onClick={() => {
          gameSocket.send({ type: 'update_settings', settings: { randomMix: true } })
          onClose()
        }}
        className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-violet/15"
      >
        <span className="text-xl">🎲</span>
        <span className="flex-1 truncate text-sm font-medium text-violet">Mix aléatoire</span>
        <span className="text-xs text-muted">toutes catégories</span>
      </button>
      <button
        type="button"
        onClick={() => {
          gameSocket.send({ type: 'update_settings', settings: { survival: true } })
          onClose()
        }}
        className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-coral/15"
      >
        <span className="text-xl">💀</span>
        <span className="flex-1 truncate text-sm font-medium text-coral">Mode Survie</span>
        <span className="text-xs text-muted">3 vies, dernier debout</span>
      </button>
      <div className="mx-3 h-px bg-line" />
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
          className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-cream/5"
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
  const medals = useMedals()
  const [copied, setCopied] = useState<'code' | 'link' | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [allCategories, setAllCategories] = useState<string[]>([])

  const isHost = youId !== null && youId === hostId
  const you = players.find((p) => p.id === youId)
  const host = players.find((p) => p.id === hostId)
  const shareUrl = `${location.origin}/game/${code}`

  const themedMode = (settings?.randomMix ?? false) || (settings?.survival ?? false)
  const selectedCategories = settings?.categories ?? null

  useEffect(() => {
    if (themedMode && allCategories.length === 0) {
      api.get<string[]>('/api/categories').then(setAllCategories).catch(() => {})
    }
  }, [themedMode, allCategories.length])

  const toggleCategory = (c: string) => {
    const current = selectedCategories ?? []
    const next = current.includes(c) ? current.filter((x) => x !== c) : [...current, c]
    gameSocket.send({
      type: 'update_settings',
      settings: { categories: next.length > 0 ? next : null },
    })
  }

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
    <div className="relative flex min-h-screen flex-col items-center">
      {user && <NavBar />}

      <div className="relative mt-10 flex w-full max-w-[1080px] flex-col gap-6 px-6">
        {/* en-tête : titre + code */}
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="flex flex-col gap-2">
            <h1 className="font-display text-[32px] font-semibold text-cream sm:text-[38px]">
              {host ? `Salon de ${host.username}` : 'Salon multijoueur'}
            </h1>
            <p className="text-[15px] text-muted-soft">
              {players.length} joueur{players.length > 1 ? 's' : ''} · l'hôte lance la partie quand tout le
              monde est prêt
            </p>
          </div>
          {/* Sous sm le bloc prend toute la largeur et ses actions passent à la ligne : aligné
              à droite sur une seule ligne, il débordait de 64 px à 390 px et le bouton
              « Partager » sortait de l'écran sans même être atteignable au scroll. */}
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
            <span className="text-xs font-semibold uppercase tracking-[2px] text-muted">Code du salon</span>
            <div className="flex flex-wrap items-center gap-3 sm:justify-end">
              <span className="font-display text-[32px] font-semibold tracking-[6px] text-cream sm:text-[44px]">
                {code}
              </span>
              <Button variant="contour" size="secondaire" icon={<Icon name="copier" size={17} />} onClick={() => copy(code ?? '', 'code')}>
                {copied === 'code' ? 'Copié ✓' : 'Copier'}
              </Button>
              <Button variant="ghost" size="secondaire" icon={<Icon name="partager" size={17} />} onClick={() => copy(shareUrl, 'link')}>
                {copied === 'link' ? 'Lien copié' : 'Partager'}
              </Button>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
          {/* joueurs + action */}
          <Card className="flex flex-1 flex-col gap-5">
            <span className="text-xs font-semibold uppercase tracking-[1.2px] text-muted">Joueurs</span>
            <div className="flex flex-wrap gap-4">
              {players.map((p) => (
                <PlayerBubble
                  key={p.id}
                  initials={initials(p.username)}
                  name={p.username}
                  color={p.avatarColor}
                  symbol={p.avatarSymbol}
                  rank={medals[p.id] ?? null}
                  host={p.id === hostId}
                  ready={p.ready}
                  pending={!p.connected}
                />
              ))}
              <button
                type="button"
                onClick={() => copy(shareUrl, 'link')}
                className="flex cursor-pointer flex-col items-center gap-2.5"
                style={{ width: 116 }}
              >
                <div className="flex h-[76px] w-[76px] items-center justify-center rounded-full border-[3px] border-dashed border-line-strong text-[22px] text-muted-deep transition hover:border-cream/40 hover:text-muted">
                  +
                </div>
                <span className="text-sm text-muted">Inviter</span>
              </button>
            </div>

            {errorMsg && (
              <button
                type="button"
                onClick={clearError}
                className="cursor-pointer rounded-lg bg-coral/12 px-4.5 py-3 text-left text-[13px] text-coral"
              >
                {errorMsg} — cliquer pour fermer
              </button>
            )}

            <div className="mt-auto flex gap-3 pt-2">
              {isHost ? (
                <Button
                  size="hero"
                  icon={<Icon name="jouer" size={20} />}
                  disabled={(!settings?.quizId && !settings?.randomMix && !settings?.survival) || players.length < 1}
                  onClick={() => gameSocket.send({ type: 'start' })}
                >
                  Lancer la partie
                </Button>
              ) : (
                <Button size="hero" variant={you?.ready ? 'contour' : 'citron'} onClick={() => gameSocket.send({ type: 'ready', ready: !you?.ready })}>
                  {you?.ready ? 'Je ne suis plus prêt' : 'Je suis prêt !'}
                </Button>
              )}
              <Button size="hero" variant="ghost" onClick={() => navigate('/')}>
                Quitter
              </Button>
            </div>

            {/* Dit avant la partie ce que l'écran de fin disait après : une partie à un
                seul joueur se joue, mais ne touche pas au classement (voir elo.py). */}
            {players.length < 2 && (
              <p className="text-[13px] text-muted-deep">
                Tout seul, la partie se joue mais ne compte pas pour le classement Elo — invite au
                moins un autre joueur.
              </p>
            )}
          </Card>

          {/* réglages */}
          <Card className="flex w-full flex-col gap-0 py-1 lg:w-[500px] lg:flex-none">
            <SettingRow label="Mode de jeu" hint="Quiz classique, mix aléatoire ou Survie" first>
              <div className="relative">
                <button
                  type="button"
                  disabled={!isHost}
                  onClick={() => setPickerOpen((v) => !v)}
                  className={`flex h-9 items-center gap-2 rounded-full bg-cream/8 px-3.5 text-sm font-semibold text-cream ${
                    isHost ? 'cursor-pointer hover:bg-cream/15' : ''
                  }`}
                >
                  {settings?.quizTitle ?? 'Choisir'}
                  {isHost && <span className="text-[10px] text-muted">▼</span>}
                </button>
                {pickerOpen && <QuizPicker onClose={() => setPickerOpen(false)} />}
              </div>
            </SettingRow>

            <SettingRow label="Questions" hint={settings?.survival ? "Jusqu'au dernier survivant" : 'Longueur de la partie'}>
              {settings?.survival ? (
                <SurvivalBadge lives={3} showLabel={false} />
              ) : isHost ? (
                <SegmentedControl
                  options={QUESTION_CHOICES.map((n) => ({ label: String(n), value: n }))}
                  value={settings?.questionCount ?? 10}
                  onChange={(v) => gameSocket.send({ type: 'update_settings', settings: { questionCount: v } })}
                />
              ) : (
                <div className="flex h-9 items-center rounded-full bg-cream/8 px-3.5 text-sm font-semibold text-cream">
                  {settings?.questionCount ?? 10}
                </div>
              )}
            </SettingRow>

            <SettingRow label="Temps par question">
              {isHost ? (
                <SegmentedControl
                  options={TIME_CHOICES.map((n) => ({ label: `${n}s`, value: n }))}
                  value={settings?.timePerQuestion ?? 30}
                  onChange={(v) => gameSocket.send({ type: 'update_settings', settings: { timePerQuestion: v } })}
                />
              ) : (
                <div className="flex h-9 items-center rounded-full bg-citron px-3.5 text-sm font-semibold text-ink">
                  {settings?.timePerQuestion ?? 30}s
                </div>
              )}
            </SettingRow>

            {themedMode && (
              <div className="flex flex-col gap-3 border-t border-line py-4">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-base font-semibold text-cream">Thèmes des questions</span>
                  <span className="text-xs text-muted">
                    {selectedCategories === null
                      ? 'Tous les thèmes'
                      : `${selectedCategories.length} thème${selectedCategories.length > 1 ? 's' : ''}`}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Chip active={selectedCategories === null} onClick={() => isHost && gameSocket.send({ type: 'update_settings', settings: { categories: null } })}>
                    Tous
                  </Chip>
                  {allCategories.map((c) => (
                    <Chip key={c} active={selectedCategories?.includes(c) ?? false} onClick={() => isHost && toggleCategory(c)}>
                      {c}
                    </Chip>
                  ))}
                </div>
              </div>
            )}

            {settings?.survival && (
              <p className="border-t border-line py-4 text-sm text-coral">
                💀 Mode Survie : 3 vies chacun, questions en chaîne sur les thèmes choisis — mauvaise
                réponse ou silence = une vie en moins. Le dernier debout gagne.
              </p>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
