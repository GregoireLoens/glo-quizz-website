import { create } from 'zustand'

import type {
  GamePhase,
  GamePlayer,
  GameQuestion,
  GameSettings,
  RankingEntry,
  RevealMessage,
  ServerMessage,
} from '../lib/types'

export type ConnectionState = 'idle' | 'connecting' | 'open' | 'reconnecting' | 'ended'

interface GameState {
  connection: ConnectionState
  endReason: string | null
  code: string | null
  youId: number | null
  phase: GamePhase
  hostId: number | null
  players: GamePlayer[]
  settings: GameSettings | null
  question: GameQuestion | null
  questionStartedAt: number | null
  selectedAnswer: number | null
  locked: boolean
  reveal: RevealMessage | null
  finalRanking: RankingEntry[] | null
  durationSec: number
  errorMsg: string | null

  setConnection: (c: ConnectionState) => void
  setEnded: (reason: string) => void
  setCode: (code: string) => void
  select: (index: number) => void
  clearError: () => void
  apply: (msg: ServerMessage) => void
  reset: () => void
}

const initial = {
  connection: 'idle' as ConnectionState,
  endReason: null,
  code: null,
  youId: null,
  phase: 'lobby' as GamePhase,
  hostId: null,
  players: [] as GamePlayer[],
  settings: null,
  question: null,
  questionStartedAt: null,
  selectedAnswer: null,
  locked: false,
  reveal: null,
  finalRanking: null,
  durationSec: 0,
  errorMsg: null,
}

export const useGameStore = create<GameState>()((set, get) => ({
  ...initial,

  setConnection: (connection) => set({ connection }),
  setEnded: (endReason) => set({ connection: 'ended', endReason }),
  setCode: (code) => set({ code }),
  select: (index) => {
    if (!get().locked && get().phase === 'question') set({ selectedAnswer: index })
  },
  clearError: () => set({ errorMsg: null }),
  reset: () => set({ ...initial }),

  apply: (msg) => {
    switch (msg.type) {
      case 'joined': {
        const s = msg.state
        set({
          youId: msg.you.id,
          phase: s.phase,
          hostId: s.hostId,
          players: s.players,
          settings: s.settings,
          question: s.question,
          questionStartedAt:
            s.question && s.phase === 'question'
              ? Date.now() - (s.question.elapsed ?? 0) * 1000
              : null,
          selectedAnswer: s.yourAnswer,
          locked: s.yourAnswer !== null,
          reveal: s.reveal,
          finalRanking: s.ranking,
          durationSec: s.durationSec,
        })
        break
      }
      case 'players':
        set({ players: msg.players, hostId: msg.hostId })
        break
      case 'settings_updated':
        set({ settings: msg.settings })
        break
      case 'question': {
        const { type: _type, ...question } = msg
        set({
          phase: 'question',
          question,
          questionStartedAt: Date.now(),
          selectedAnswer: null,
          locked: false,
          reveal: null,
          errorMsg: null,
        })
        break
      }
      case 'answer_ack':
        set({ locked: true })
        break
      case 'player_answered':
        set({
          players: get().players.map((p) =>
            p.id === msg.playerId ? { ...p, answered: true } : p,
          ),
        })
        break
      case 'reveal': {
        const scoreById = new Map(msg.results.map((r) => [r.playerId, r.score]))
        set({
          phase: 'reveal',
          reveal: msg,
          players: get().players.map((p) => ({
            ...p,
            score: scoreById.get(p.id) ?? p.score,
          })),
        })
        break
      }
      case 'game_over':
        set({ phase: 'finished', finalRanking: msg.ranking, durationSec: msg.durationSec })
        break
      case 'lobby_reset':
        set({
          phase: 'lobby',
          players: msg.players,
          settings: msg.settings,
          hostId: msg.hostId,
          question: null,
          questionStartedAt: null,
          selectedAnswer: null,
          locked: false,
          reveal: null,
          finalRanking: null,
          durationSec: 0,
          errorMsg: null,
        })
        break
      case 'error':
        set({ errorMsg: msg.message })
        break
    }
  },
}))
