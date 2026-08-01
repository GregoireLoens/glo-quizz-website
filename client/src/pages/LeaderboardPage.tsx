import { useEffect, useState } from 'react'

import { GlowBackdrop } from '../components/GlowBackdrop'
import { LeaderboardRow } from '../components/LeaderboardRow'
import { NavBar } from '../components/NavBar'
import { SegmentedControl } from '../components/SegmentedControl'
import { api } from '../lib/api'
import type { LeaderboardResponse } from '../lib/types'
import { initials } from '../lib/utils'
import { useAuthStore } from '../stores/authStore'
import { useLeadersStore } from '../stores/leadersStore'

type Period = 'week' | 'month' | 'all'

export function LeaderboardPage() {
  const user = useAuthStore((s) => s.user)
  const [period, setPeriod] = useState<Period>('all')
  const [data, setData] = useState<LeaderboardResponse | null>(null)

  useEffect(() => {
    api.get<LeaderboardResponse>(`/api/leaderboard?period=${period}&limit=10`).then(setData).catch(() => {})
  }, [period])

  // les médailles marquent le top 3 général : sur cette page on les veut à jour, pas en cache
  useEffect(() => {
    useLeadersStore.getState().load(true)
  }, [])

  const entries = data?.entries ?? []
  const me = data?.me ?? null
  const meOutsideList = me !== null && !entries.some((e) => e.userId === me.userId)
  const showProgress = period !== 'all'

  const row = (entry: NonNullable<typeof me>) => (
    <LeaderboardRow
      key={entry.userId}
      rank={entry.rank}
      initials={initials(entry.username)}
      name={entry.username}
      meta={`${entry.gamesPlayed} partie${entry.gamesPlayed > 1 ? 's' : ''}`}
      value={entry.elo}
      delta={showProgress ? entry.eloDelta : null}
      me={user !== null && entry.userId === user.id}
    />
  )

  return (
    <div className="relative min-h-screen overflow-hidden px-6">
      <GlowBackdrop color="var(--color-violet)" x="80%" y="10%" size={620} opacity={0.12} />
      <NavBar />

      <div className="relative mx-auto mt-14 flex w-full max-w-[1080px] flex-col items-center gap-2.5">
        <div className="inline-flex h-[30px] items-center gap-2 rounded-full bg-citron/14 px-3.5">
          <span className="h-1.5 w-1.5 rounded-full bg-citron" />
          <span className="text-xs font-semibold uppercase tracking-[1.5px] text-citron">
            Classement Elo
          </span>
        </div>
        <h1 className="text-center font-display text-[30px] font-semibold text-cream sm:text-[34px] md:text-[46px]">
          Qui domine Midi Quizz ?
        </h1>
        <p className="text-center text-[15px] text-muted-soft">
          {showProgress
            ? 'Progression sur la période — battre plus fort que soi rapporte plus.'
            : 'Chacun démarre à 1000 — seules les parties à plusieurs font bouger le classement.'}
        </p>
      </div>

      <div className="relative mt-6 flex justify-center">
        <SegmentedControl<Period>
          options={[
            { label: 'Cette semaine', value: 'week' },
            { label: 'Ce mois', value: 'month' },
            { label: 'Depuis toujours', value: 'all' },
          ]}
          value={period}
          onChange={setPeriod}
        />
      </div>

      {entries.length === 0 ? (
        <div className="relative mx-auto mt-10 max-w-[560px] rounded-xl border border-line bg-card p-10 text-center text-muted">
          Aucune partie classée sur cette période — lance un quiz à plusieurs pour inaugurer le
          classement !
        </div>
      ) : (
        <div className="relative mx-auto mb-14 mt-10 flex w-full max-w-[720px] flex-col gap-2">
          {entries.map(row)}
          {meOutsideList && me && (
            <>
              <div className="my-1 flex items-center gap-3 px-1">
                <div className="h-px flex-1 bg-line" />
                <span className="text-xs text-muted-deep">ta position</span>
                <div className="h-px flex-1 bg-line" />
              </div>
              {row(me)}
            </>
          )}
        </div>
      )}
    </div>
  )
}
