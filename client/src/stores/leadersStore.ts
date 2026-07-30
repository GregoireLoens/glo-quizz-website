import { create } from 'zustand'

import { api } from '../lib/api'
import type { LeaderboardResponse } from '../lib/types'

export type MedalRank = 1 | 2 | 3

interface LeadersState {
  /** userId → place au classement général (Elo « depuis toujours »), top 3 uniquement. */
  medals: Record<number, MedalRank>
  load: (force?: boolean) => void
}

const FRESH_MS = 60_000

let fetchedAt = 0
let inFlight = false

/**
 * Les 3 premiers du classement général, disponibles partout dans l'app pour marquer
 * les leaders (or/argent/bronze) sur leur bulle d'avatar. Le classement de référence est
 * « depuis toujours » — le seul où le rang a un sens absolu (cf. `routers/leaderboard.py`).
 */
export const useLeadersStore = create<LeadersState>((set) => ({
  medals: {},
  load: (force = false) => {
    if (inFlight) return
    if (!force && Date.now() - fetchedAt < FRESH_MS) return
    inFlight = true
    api
      .get<LeaderboardResponse>('/api/leaderboard?period=all&limit=3')
      .then(({ entries }) => {
        const medals: Record<number, MedalRank> = {}
        for (const e of entries) {
          if (e.rank <= 3) medals[e.userId] = e.rank as MedalRank
        }
        set({ medals })
        fetchedAt = Date.now()
      })
      .catch(() => {
        // pas de médaille plutôt qu'un écran cassé : le classement est décoratif ici
      })
      .finally(() => {
        inFlight = false
      })
  },
}))

/** Table complète — pour les listes, où un hook par ligne serait impossible. */
export const useMedals = () => useLeadersStore((s) => s.medals)

export function useMedal(userId: number | null | undefined): MedalRank | null {
  return useLeadersStore((s) => (userId == null ? null : s.medals[userId] ?? null))
}
