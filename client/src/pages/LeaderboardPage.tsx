import { useEffect, useState } from 'react'

import { EloDelta } from '../components/EloDelta'
import { GlowBackdrop, AUTH_GLOWS } from '../components/GlowBackdrop'
import { NavPill } from '../components/NavPill'
import { SegmentedControl } from '../components/SegmentedControl'
import { api } from '../lib/api'
import type { LeaderboardEntry, LeaderboardResponse } from '../lib/types'
import { initials } from '../lib/utils'
import { useAuthStore } from '../stores/authStore'

type Period = 'week' | 'month' | 'all'

const PODIUM_STYLES = [
  { border: '#9C8DF2', label: '2ᵉ place', avatar: 56, lift: false },
  { border: '#C7F45C', label: '', avatar: 68, lift: true },
  { border: '#F0492E', label: '3ᵉ place', avatar: 56, lift: false },
]

function PodiumCard({
  entry,
  spot,
  className = '',
}: {
  entry?: LeaderboardEntry
  spot: number
  className?: string
}) {
  const style = PODIUM_STYLES[spot]
  if (!entry) return <div className={`mx-auto w-full max-w-[240px] ${className}`} />
  const bigSize = style.lift ? 'text-[26px]' : 'text-[22px]'
  return (
    <div
      className={`mx-auto flex w-full max-w-[240px] flex-col items-center gap-2 rounded-3xl bg-card p-5 ${
        style.lift ? 'py-6 sm:-mt-4' : ''
      } ${className}`}
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
      <span className="text-[13px] text-muted">
        {entry.gamesPlayed} partie{entry.gamesPlayed > 1 ? 's' : ''}
      </span>
      {/* le grand chiffre est toujours le critère de tri de l'onglet affiché */}
      {entry.eloDelta === null ? (
        <span
          className={`font-display font-semibold ${bigSize}`}
          style={{ color: style.border }}
        >
          {entry.elo} Elo
        </span>
      ) : (
        <>
          <EloDelta delta={entry.eloDelta} className={`font-display ${bigSize}`} />
          <span className="-mt-1 text-[13px] text-muted-deep">{entry.elo} Elo</span>
        </>
      )}
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
  const showProgress = period !== 'all'

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
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <div
            className={`flex h-8 w-8 flex-none items-center justify-center rounded-full text-xs font-semibold ${
              isMe ? 'bg-citron text-ink' : 'bg-cream/10 text-cream'
            }`}
          >
            {initials(entry.username)}
          </div>
          <span
            className={`truncate text-sm ${isMe ? 'font-semibold text-citron' : 'font-medium text-cream'}`}
          >
            {entry.username}
            {isMe && ' (vous)'}
          </span>
        </div>
        <span
          className={`hidden w-[100px] text-center text-[13px] sm:block ${isMe ? 'text-citron' : 'text-muted'}`}
        >
          {entry.gamesPlayed}
        </span>
        {showProgress && (
          <span className="w-[64px] text-right text-[13px] sm:w-[100px]">
            {entry.eloDelta !== null && <EloDelta delta={entry.eloDelta} />}
          </span>
        )}
        <span
          className={`w-[64px] text-right text-sm sm:w-[100px] ${isMe ? 'font-bold text-citron' : 'font-semibold text-cream'}`}
        >
          {entry.elo}
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
          Aucune partie classée sur cette période — lance un quiz à plusieurs pour inaugurer le
          classement !
        </div>
      ) : (
        <>
          <div className="relative mx-auto mt-8 grid max-w-[760px] grid-cols-1 items-start gap-4 sm:grid-cols-3">
            <PodiumCard entry={entries[1]} spot={0} className="order-2 sm:order-none" />
            <PodiumCard entry={entries[0]} spot={1} className="order-1 sm:order-none" />
            <PodiumCard entry={entries[2]} spot={2} className="order-3 sm:order-none" />
          </div>

          {(listed.length > 0 || meOutsideList) && (
            <div className="relative mx-auto mb-14 mt-8 flex w-full max-w-[760px] flex-col rounded-3xl bg-card p-2">
              <div className="flex items-center gap-4 px-4.5 py-2.5">
                <span className="w-6 text-[11px] font-semibold text-muted-deep">#</span>
                <span className="flex-1 text-[11px] font-semibold uppercase tracking-wider text-muted-deep">
                  Joueur
                </span>
                <span className="hidden w-[100px] text-center text-[11px] font-semibold text-muted-deep sm:block">
                  Parties
                </span>
                {showProgress && (
                  <span className="w-[64px] text-right text-[11px] font-semibold text-muted-deep sm:w-[100px]">
                    Progression
                  </span>
                )}
                <span className="w-[64px] text-right text-[11px] font-semibold text-muted-deep sm:w-[100px]">
                  Elo
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
