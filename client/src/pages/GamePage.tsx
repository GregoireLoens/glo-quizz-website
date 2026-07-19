import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import {
  GlowBackdrop,
  GAME_GLOWS,
  LOBBY_GLOWS,
  RESULT_GLOWS,
} from '../components/GlowBackdrop'
import { PillButton } from '../components/PillButton'
import { gameSocket } from '../lib/ws'
import { useGameStore } from '../stores/gameStore'
import { LobbyView } from './game/LobbyView'
import { PlayingView } from './game/PlayingView'
import { ResultsView } from './game/ResultsView'

const END_MESSAGES: Record<string, string> = {
  room_not_found: "Cette partie n'existe pas ou est déjà terminée.",
  already_started: 'La partie a déjà commencé sans toi.',
  room_closed: 'Le salon a été fermé pour cause d’inactivité.',
  invalid_token: 'Ta session a expiré — reconnecte-toi.',
}

export function GamePage() {
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()
  const connection = useGameStore((s) => s.connection)
  const endReason = useGameStore((s) => s.endReason)
  const phase = useGameStore((s) => s.phase)
  const youId = useGameStore((s) => s.youId)

  useEffect(() => {
    if (!code) return
    gameSocket.connect(code)
    return () => {
      gameSocket.close()
      useGameStore.getState().reset()
    }
  }, [code])

  if (connection === 'ended') {
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center gap-6 overflow-hidden px-6">
        <GlowBackdrop glows={LOBBY_GLOWS} />
        <span className="relative text-[44px]">😕</span>
        <p className="relative max-w-md text-center text-lg text-cream-soft">
          {END_MESSAGES[endReason ?? ''] ?? 'La connexion à la partie a été interrompue.'}
        </p>
        <div className="relative flex gap-3">
          <PillButton onClick={() => navigate('/join')}>Rejoindre une autre partie</PillButton>
          <PillButton variant="outline" onClick={() => navigate('/')}>
            Retour à l'accueil
          </PillButton>
        </div>
      </div>
    )
  }

  if (youId === null) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-cream/15 border-t-citron" />
        <span className="text-sm text-muted">
          {connection === 'reconnecting' ? 'Reconnexion…' : 'Connexion au salon…'}
        </span>
      </div>
    )
  }

  const glows = phase === 'lobby' ? LOBBY_GLOWS : phase === 'finished' ? RESULT_GLOWS : GAME_GLOWS

  return (
    <div className="relative min-h-screen overflow-hidden">
      <GlowBackdrop glows={glows} />
      {connection === 'reconnecting' && (
        <div className="fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-full bg-coral/90 px-5 py-2 text-[13px] font-semibold text-cream">
          Connexion perdue — reconnexion en cours…
        </div>
      )}
      {phase === 'lobby' && <LobbyView />}
      {(phase === 'question' || phase === 'reveal') && <PlayingView />}
      {phase === 'finished' && <ResultsView />}
    </div>
  )
}
