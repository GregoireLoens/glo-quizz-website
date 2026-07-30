import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

import { EloDelta } from '../../components/EloDelta'
import { PillButton } from '../../components/PillButton'
import { Podium } from '../../components/Podium'
import { RankingList } from '../../components/RankingList'
import { api } from '../../lib/api'
import { formatDuration } from '../../lib/utils'
import { gameSocket } from '../../lib/ws'
import { useGameStore } from '../../stores/gameStore'
import { useLeadersStore } from '../../stores/leadersStore'

export function ResultsView() {
  const navigate = useNavigate()
  const { youId, hostId, finalRanking, durationSec, settings, question, players, questionsPlayed } =
    useGameStore()

  // Une partie solo n'est pas classée : le serveur renvoie alors des deltas nuls.
  const rated = finalRanking?.some((entry) => entry.eloDelta != null) ?? false

  // l'Elo vient de bouger : le top 3 général (donc les médailles) a pu changer de mains
  useEffect(() => {
    if (rated) useLeadersStore.getState().load(true)
  }, [rated])

  if (!finalRanking || finalRanking.length === 0) return null

  const winner = finalRanking[0]
  const questionTotal = questionsPlayed ?? question?.total ?? settings?.questionCount ?? 10
  const isHost = youId !== null && youId === hostId
  const survival = settings?.survival ?? false
  const you = finalRanking.find((entry) => entry.playerId === youId)

  const newQuiz = async () => {
    const res = await api.post<{ code: string }>('/api/games', {})
    navigate(`/game/${res.code}`) // le GamePage se reconnecte tout seul au changement de code
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center px-6">
      <div className="relative mt-[52px] flex flex-col items-center gap-2">
        <span className="text-[44px]">{survival ? '💀' : '🏆'}</span>
        <span className="text-center font-display text-[26px] font-semibold text-cream sm:text-[32px]">
          {winner.username} {survival ? 'survit à la partie !' : 'remporte la partie !'}
        </span>
        <span className="text-[13.5px] text-muted">
          {questionTotal} questions · {players.length} joueur{players.length > 1 ? 's' : ''} ·{' '}
          {formatDuration(durationSec)}
        </span>
        {you?.eloDelta != null && you.eloBefore != null && (
          <span className="mt-1 inline-flex items-center gap-2 rounded-full bg-cream/10 px-4 py-1.5 text-[13px] text-cream">
            Ton Elo : <strong className="font-semibold">{you.eloBefore + you.eloDelta}</strong>
            <EloDelta delta={you.eloDelta} />
          </span>
        )}
        {!rated && (
          <span className="mt-1 text-[13px] text-muted-deep">
            Partie solo — le classement Elo n'est pas impacté.
          </span>
        )}
      </div>

      <div className="relative mt-11">
        <Podium ranking={finalRanking} />
      </div>

      <div className="relative mt-11 w-full max-w-[640px]">
        <RankingList ranking={finalRanking} youId={youId} questionTotal={questionTotal} />
      </div>

      <div className="relative mb-14 mt-9 flex flex-wrap items-center justify-center gap-3.5">
        {isHost ? (
          <PillButton onClick={() => gameSocket.send({ type: 'play_again' })}>Rejouer</PillButton>
        ) : (
          <span className="text-[13px] text-muted">L'hôte peut relancer la partie —</span>
        )}
        <PillButton variant="outline" onClick={newQuiz}>
          Nouveau quiz
        </PillButton>
        <PillButton variant="ghost" onClick={() => navigate('/')}>
          Quitter le salon
        </PillButton>
      </div>
    </div>
  )
}
