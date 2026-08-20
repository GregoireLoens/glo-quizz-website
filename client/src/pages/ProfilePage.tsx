import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Avatar } from '../components/Avatar'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { EloDelta } from '../components/EloDelta'
import { EloSparkline } from '../components/EloSparkline'
import { GlowBackdrop } from '../components/GlowBackdrop'
import { NavBar } from '../components/NavBar'
import { api } from '../lib/api'
import type { Profile, ProfileGame } from '../lib/types'
import { formatGameDate, formatPoints, formatRank, initials } from '../lib/utils'
import { useAuthStore } from '../stores/authStore'
import { useMedal } from '../stores/leadersStore'

const MEDAL: Record<number, string> = { 1: 'bg-gold text-ink', 2: 'bg-silver text-ink', 3: 'bg-bronze text-ink' }

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <span className="font-display text-2xl font-semibold tabular-nums text-cream">{value}</span>
      <span className="text-[13px] text-muted-soft">{label}</span>
    </div>
  )
}

/** Une partie de l'historique. Le titre manque sur un Mix aléatoire, une partie en Survie
 * ou un quiz retiré du catalogue depuis : on ne devine pas, on le dit. */
function GameRow({ game }: { game: ProfileGame }) {
  const solo = game.playerCount < 2
  return (
    <div className="flex items-center gap-4 rounded-lg border border-line bg-card px-3 py-4 sm:gap-5">
      <span
        className={`flex h-[30px] w-[30px] flex-none items-center justify-center rounded-full text-sm font-semibold tabular-nums ${
          solo ? 'bg-cream/6 text-muted' : (MEDAL[game.rank] ?? 'bg-cream/6 text-muted')
        }`}
      >
        {game.rank}
      </span>
      <span className="flex-none text-xl">{game.quizEmoji ?? '🎲'}</span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-base font-semibold text-cream">
          {game.quizTitle ?? 'Partie sans quiz attitré'}
        </span>
        <span className="text-sm text-muted-soft">
          {game.correctCount}
          {game.questionCount !== null && `/${game.questionCount}`} bonnes ·{' '}
          {solo ? 'en solo' : `${formatRank(game.rank)} sur ${game.playerCount}`}
          {game.finishedAt && ` · ${formatGameDate(game.finishedAt)}`}
        </span>
        <span className="mt-1.5 flex items-center gap-3 sm:hidden">
          <span className="font-display text-base font-semibold tabular-nums text-cream">
            {formatPoints(game.score)} pts
          </span>
          {game.eloDelta !== null && <EloDelta delta={game.eloDelta} size="sm" />}
        </span>
      </div>
      <div className="hidden flex-none items-center gap-5 sm:flex">
        {game.eloDelta !== null && <EloDelta delta={game.eloDelta} />}
        <span className="w-[86px] text-right font-display text-lg font-semibold tabular-nums text-cream">
          {formatPoints(game.score)} pts
        </span>
      </div>
    </div>
  )
}

export function ProfilePage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const medal = useMedal(user?.id)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    api.get<Profile>('/api/me').then(setProfile).catch(() => setFailed(true))
  }, [])

  // Les parties classées, de la plus ancienne à la plus récente : le serveur les renvoie
  // dans l'autre sens (historique), et une partie solo n'a pas de rating à porter.
  const rated = [...(profile?.games ?? [])]
    .reverse()
    .filter((g) => g.eloBefore !== null && g.eloDelta !== null)
  const series = rated.length > 0 ? [rated[0].eloBefore!, ...rated.map((g) => g.eloBefore! + g.eloDelta!)] : []
  const seriesLabels =
    rated.length > 0
      ? ['avant la première partie classée', ...rated.map((g) => `${formatRank(g.rank)} sur ${g.playerCount} · ${formatGameDate(g.finishedAt)}`)]
      : []

  const stats = profile?.stats
  const successRate =
    stats && stats.questionCount > 0 ? Math.round((100 * stats.correctCount) / stats.questionCount) : null

  return (
    <div className="relative min-h-screen overflow-hidden px-6">
      <GlowBackdrop color="var(--color-citron)" x="50%" y="-4%" size={620} opacity={0.12} />
      <NavBar />

      <div className="relative mx-auto flex max-w-[760px] flex-col gap-6 pb-20 pt-10 sm:pt-14">
        {/* identité + rating */}
        <div className="flex flex-wrap items-center gap-5">
          <Avatar
            initials={initials(user?.username ?? '')}
            name={user?.username ?? ''}
            color={user?.avatarColor}
            symbol={user?.avatarSymbol}
            rank={medal}
            size={84}
          />
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="truncate font-display text-[28px] font-semibold text-cream sm:text-[34px]">
              {user?.username}
            </h1>
            {profile && (
              <p className="text-[15px] text-muted-soft">
                <strong className="font-semibold tabular-nums text-cream">{formatPoints(profile.elo)} Elo</strong>
                {profile.rank !== null
                  ? ` · ${formatRank(profile.rank)} sur ${profile.rankedPlayers} joueur${profile.rankedPlayers > 1 ? 's' : ''} classé${profile.rankedPlayers > 1 ? 's' : ''}`
                  : ' · pas encore classé — joue une partie à plusieurs'}
              </p>
            )}
          </div>
        </div>

        {failed && (
          <Card className="text-center text-muted">
            Impossible de charger ton profil pour le moment.
          </Card>
        )}

        {stats && (
          <Card className="grid grid-cols-2 gap-5 sm:flex sm:flex-wrap sm:gap-6">
            <Stat value={formatPoints(stats.games)} label={`partie${stats.games > 1 ? 's' : ''} jouée${stats.games > 1 ? 's' : ''}`} />
            <Stat value={formatPoints(stats.wins)} label={`victoire${stats.wins > 1 ? 's' : ''}`} />
            <Stat value={successRate !== null ? `${successRate} %` : '—'} label="de bonnes réponses" />
            <Stat value={formatPoints(stats.ratedGames)} label={`partie${stats.ratedGames > 1 ? 's' : ''} classée${stats.ratedGames > 1 ? 's' : ''}`} />
          </Card>
        )}

        {series.length >= 3 && (
          <Card className="flex flex-col gap-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-display text-lg font-semibold text-cream">Progression du rating</span>
              <span className="text-[13px] text-muted">
                {rated.length} partie{rated.length > 1 ? 's' : ''} classée{rated.length > 1 ? 's' : ''} · le
                repère est le rating de départ
              </span>
            </div>
            <EloSparkline points={series} labels={seriesLabels} />
          </Card>
        )}

        {/* historique */}
        <div className="flex flex-col gap-3">
          <span className="font-display text-lg font-semibold text-cream">Dernières parties</span>
          {profile && profile.games.length === 0 ? (
            <Card className="flex flex-col items-center gap-4 py-10 text-center">
              <span className="text-muted">Aucune partie terminée pour l'instant.</span>
              <Button onClick={() => navigate('/join')}>Rejoindre une partie</Button>
            </Card>
          ) : (
            profile?.games.map((g) => <GameRow key={g.gameId} game={g} />)
          )}
        </div>
      </div>
    </div>
  )
}
