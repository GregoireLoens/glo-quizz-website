import { useEffect, useState } from 'react'

import { GlowBackdrop, AUTH_GLOWS } from '../components/GlowBackdrop'
import { NavPill } from '../components/NavPill'
import { SegmentedControl } from '../components/SegmentedControl'
import { api } from '../lib/api'
import type { LeaderboardEntry, LeaderboardResponse } from '../lib/types'
import { formatPoints, initials } from '../lib/utils'
import { useAuthStore } from '../stores/authStore'

type Period = 'week' | 'month' | 'all'

const PODIUM_STYLES = [
  { border: '#9C8DF2', label: '2ᵉ place', avatar: 56, lift: false },
  { border: '#C7F45C', label: '', avatar: 68, lift: true },
  { border: '#F0492E', label: '3ᵉ place', avatar: 56, lift: false },
]

function PodiumCard({ entry, spot }: { entry?: LeaderboardEntry; spot: number }) {
  const style = PODIUM_STYLES[spot]
  if (!entry) return <div className="w-full max-w-[240px]" />
  return (
    <div
      className={`flex w-full max-w-[240px] flex-col items-center gap-2 rounded-3xl bg-card p-5 ${
        style.lift ? '-mt-4 py-6' : ''
      }`}
      style={{ border: `1.5px solid ${style.border}` }}
    >
      {style.lift ? (
        <span className="text-[26px]">🏆</span>
      ) : (
        <span className="font-display text-[13px] font-semibold" style={{ color: style.border }}>
          {style.label}
        </span>
      )}
      <div
        className="flex items-center justify-center rounded-full font-semibold text-ink"
        style={{
          width: style.avatar,
          height: style.avatar,
          background: style.border,
          fontSize: style.avatar * 0.28,
        }}
      >
        {initials(entry.username)}
      </div>
      <span className={`text-cream ${style.lift ? 'text-base font-bold' : 'text-[15px] font-semibold'}`}>
        {entry.username}
      </span>
      <span className="text-[13px] text-muted">{entry.gamesPlayed} parties</span>
      <span
        className={`font-display font-semibold ${style.lift ? 'text-[26px]' : 'text-[22px]'}`}
        style={{ color: style.border }}
      >
        {formatPoints(entry.totalPoints)} pts
      </span>
    </div>
  )
}

export function LeaderboardPage() {
  const user = useAuthStore((s) => s.user)
  const [period, setPeriod] = useState<Period>('all')
  const [data, setData] = useState<LeaderboardResponse | null>(null)

  useEffect(() => {
    api.get<LeaderboardResponse>(`/api/leaderboard?period=${period}&limit=10`).then(setData).catch(() => {})
  }, [period])

  const entries = data?.entries ?? []
  const me = data?.me ?? null
  const listed = entries.slice(3)
  const meOutsideList = me !== null && !entries.some((e) => e.userId === me.userId)

  const row = (entry: LeaderboardEntry) => {
    const isMe = user !== null && entry.userId === user.id
    return (
      <div
        key={entry.userId}
        className={`flex items-center gap-4 px-4.5 py-3 ${isMe ? 'rounded-2xl bg-citron/12' : ''}`}
      >
        <span className={`w-6 text-[13px] font-bold ${isMe ? 'text-citron' : 'text-cream'}`}>
          {entry.rank}
        </span>
        <div className="flex flex-1 items-center gap-2.5">
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold ${
              isMe ? 'bg-citron text-ink' : 'bg-cream/10 text-cream'
            }`}
          >
            {initials(entry.username)}
          </div>
          <span className={`text-sm ${isMe ? 'font-semibold text-citron' : 'font-medium text-cream'}`}>
            {entry.username}
            {isMe && ' (vous)'}
          </span>
        </div>
        <span className={`w-[100px] text-center text-[13px] ${isMe ? 'text-citron' : 'text-muted'}`}>
          {entry.gamesPlayed}
        </span>
        <span
          className={`w-[120px] text-right text-sm ${isMe ? 'font-bold text-citron' : 'font-semibold text-cream'}`}
        >
          {formatPoints(entry.totalPoints)} pts
        </span>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen overflow-hidden px-6">
      <GlowBackdrop glows={AUTH_GLOWS} />
      <NavPill />

      <div className="relative mx-auto mt-14 flex w-full max-w-[1080px] flex-col items-center gap-2.5">
        <div className="inline-flex h-[30px] items-center gap-2 rounded-full bg-citron/14 px-3.5">
          <span className="h-1.5 w-1.5 rounded-full bg-citron" />
          <span className="text-xs font-semibold uppercase tracking-[1.5px] text-citron">
            Classement général
          </span>
        </div>
        <h1 className="text-center font-display text-[34px] font-semibold text-cream md:text-[46px]">
          Qui domine Midi Quizz ?
        </h1>
        <p className="text-center text-[15px] text-muted-soft">
          Tous les joueurs, toutes les parties confondues.
        </p>
      </div>

      <div className="relative mt-6 flex justify-center">
        <SegmentedControl<Period>
          boxed
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
        <div className="relative mx-auto mt-10 max-w-[560px] rounded-[28px] bg-card p-10 text-center text-muted">
          Aucune partie terminée sur cette période — lance un quiz pour inaugurer le classement !
        </div>
      ) : (
        <>
          <div className="relative mx-auto mt-8 grid max-w-[760px] grid-cols-1 items-start gap-4 sm:grid-cols-3">
            <PodiumCard entry={entries[1]} spot={0} />
            <PodiumCard entry={entries[0]} spot={1} />
            <PodiumCard entry={entries[2]} spot={2} />
          </div>

          {(listed.length > 0 || meOutsideList) && (
            <div className="relative mx-auto mb-14 mt-8 flex w-full max-w-[760px] flex-col rounded-3xl bg-card p-2">
              <div className="flex items-center gap-4 px-4.5 py-2.5">
                <span className="w-6 text-[11px] font-semibold text-muted-deep">#</span>
                <span className="flex-1 text-[11px] font-semibold uppercase tracking-wider text-muted-deep">
                  Joueur
                </span>
                <span className="w-[100px] text-center text-[11px] font-semibold text-muted-deep">
                  Parties
                </span>
                <span className="w-[120px] text-right text-[11px] font-semibold text-muted-deep">
                  Points
                </span>
              </div>
              {listed.map(row)}
              {meOutsideList && me && (
                <>
                  <div className="mx-4 my-1 border-t border-dashed border-cream/10" />
                  {row(me)}
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
