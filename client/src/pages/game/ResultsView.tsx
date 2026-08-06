import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

import { Button } from '../../components/Button'
import { EloDelta } from '../../components/EloDelta'
import { Icon } from '../../components/Icon'
import { LeaderboardRow } from '../../components/LeaderboardRow'
import { Podium } from '../../components/Podium'
import { api } from '../../lib/api'
import { formatDuration, formatPoints, initials } from '../../lib/utils'
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
  // Personne ne « survit » quand tout le monde perd sa dernière vie sur la même
  // question : le premier du classement l'est alors à la longévité, pas en vie.
  const survivalTitle = winner.lives > 0 ? 'survit à la partie !' : 'tient le plus longtemps !'
  const you = finalRanking.find((entry) => entry.playerId === youId)
  const podium = finalRanking.filter((e) => e.rank <= 3)
  const rest = finalRanking.filter((e) => e.rank > 3)

  const newQuiz = async () => {
    const res = await api.post<{ code: string }>('/api/games', {})
    navigate(`/game/${res.code}`) // le GamePage se reconnecte tout seul au changement de code
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center px-6">
      <div className="relative mt-[52px] flex flex-col items-center gap-2">
        <span className="text-[44px]">{survival ? '💀' : '🏆'}</span>
        <span className="text-center font-display text-[26px] font-semibold text-cream sm:text-[32px]">
          {winner.username} {survival ? survivalTitle : 'remporte la partie !'}
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
        <Podium
          players={podium.map((e) => ({
            rank: e.rank as 1 | 2 | 3,
            name: e.username,
            initials: initials(e.username),
            color: e.avatarColor,
            symbol: e.avatarSymbol,
            detail: `${e.correctCount} bonne${e.correctCount > 1 ? 's' : ''}`,
            points: `${formatPoints(e.score)} pts`,
          }))}
        />
      </div>

      {rest.length > 0 && (
        <div className="relative mt-11 flex w-full max-w-[640px] flex-col gap-2">
          {rest.map((entry) => (
            <LeaderboardRow
              key={entry.playerId}
              rank={entry.rank}
              initials={initials(entry.username)}
              name={entry.username}
              color={entry.avatarColor}
              symbol={entry.avatarSymbol}
              meta={`${entry.correctCount}/${questionTotal} bonnes réponses`}
              value={`${formatPoints(entry.score)} pts`}
              delta={entry.eloDelta}
              me={entry.playerId === youId}
            />
          ))}
        </div>
      )}

      <div className="relative mb-14 mt-9 flex flex-wrap items-center justify-center gap-3.5">
        {isHost ? (
          <Button icon={<Icon name="jouer" size={18} />} onClick={() => gameSocket.send({ type: 'play_again' })}>
            Rejouer
          </Button>
        ) : (
          <span className="text-[13px] text-muted">L'hôte peut relancer la partie —</span>
        )}
        <Button variant="contour" onClick={newQuiz}>
          Nouveau quiz
        </Button>
        <Button variant="ghost" onClick={() => navigate('/')}>
          Quitter le salon
        </Button>
      </div>
    </div>
  )
}
