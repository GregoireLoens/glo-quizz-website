import { create } from 'zustand'

import type {
  GamePhase,
  GamePlayer,
  GameQuestion,
  GameSettings,
  JokerKind,
  RankingEntry,
  RevealMessage,
  ServerMessage,
} from '../lib/types'

/** Dernier joker joué, affiché en bandeau quelques secondes. `targetId` non nul = agression. */
export interface JokerEvent {
  playerId: number
  kind: JokerKind
  targetId: number | null
  at: number
}

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
  /** Classement du reveal précédent — sert à afficher les places gagnées ou perdues. */
  previousRanking: RankingEntry[] | null
  finalRanking: RankingEntry[] | null
  durationSec: number
  questionsPlayed: number | null
  errorMsg: string | null
  /** Réponses masquées par un moitié-moitié sur la question en cours. */
  hiddenAnswers: number[]
  /** « Double ou rien » engagé sur la question en cours. */
  doubleActive: boolean
  /** Date de fin du brouillage subi (Date.now()), null si aucun. */
  scrambledUntil: number | null
  lastJoker: JokerEvent | null

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
  previousRanking: null,
  finalRanking: null,
  durationSec: 0,
  questionsPlayed: null,
  errorMsg: null,
  hiddenAnswers: [] as number[],
  doubleActive: false,
  scrambledUntil: null,
  lastJoker: null as JokerEvent | null,
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
          // une reconnexion ne connaît pas le classement d'avant : pas de flèches au
          // premier reveal qui suit, plutôt qu'un mouvement inventé
          previousRanking: null,
          finalRanking: s.ranking,
          durationSec: s.durationSec,
          questionsPlayed: s.questionsPlayed,
          // une reconnexion en pleine question doit retrouver ses jokers en cours,
          // sinon le moitié-moitié payé disparaît avec la socket
          hiddenAnswers: s.jokerState?.hidden ?? [],
          doubleActive: s.jokerState?.double ?? false,
          scrambledUntil:
            s.jokerState && s.jokerState.scrambledFor > 0
              ? Date.now() + s.jokerState.scrambledFor * 1000
              : null,
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
          players: get().players.map((p) => (p.answered ? { ...p, answered: false } : p)),
          questionStartedAt: Date.now(),
          selectedAnswer: null,
          locked: false,
          // Le classement qu'on quitte est mis de côté ici, et non à l'arrivée du reveal
          // suivant : `reveal` vient d'être vidé, il n'y aurait plus rien à sauvegarder.
          // C'est lui qui donnera les places gagnées ou perdues au prochain reveal.
          previousRanking: get().reveal?.ranking ?? get().previousRanking,
          reveal: null,
          errorMsg: null,
          // les effets de joker ne valent que pour une question
          hiddenAnswers: [],
          doubleActive: false,
          scrambledUntil: null,
          lastJoker: null,
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
        const resultById = new Map(msg.results.map((r) => [r.playerId, r]))
        set({
          phase: 'reveal',
          reveal: msg,
          players: get().players.map((p) => {
            const r = resultById.get(p.id)
            return r ? { ...p, score: r.score, lives: r.lives } : p
          }),
        })
        break
      }
      case 'joker_hidden':
        // seules deux mauvaises réponses sont nommées : la bonne ne sort jamais du serveur
        if (get().question?.index === msg.questionIndex) set({ hiddenAnswers: msg.hidden })
        break
      case 'joker_scrambled':
        if (get().question?.index === msg.questionIndex) {
          set({ scrambledUntil: Date.now() + msg.seconds * 1000 })
        }
        break
      case 'joker_used':
        set({
          lastJoker: { playerId: msg.playerId, kind: msg.kind, targetId: msg.targetId, at: Date.now() },
          doubleActive:
            msg.kind === 'double' && msg.playerId === get().youId ? true : get().doubleActive,
        })
        break
      case 'game_over':
        set({
          phase: 'finished',
          finalRanking: msg.ranking,
          durationSec: msg.durationSec,
          questionsPlayed: msg.questionsPlayed,
        })
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
          previousRanking: null,
          finalRanking: null,
          durationSec: 0,
          questionsPlayed: null,
          errorMsg: null,
          hiddenAnswers: [],
          doubleActive: false,
          scrambledUntil: null,
          lastJoker: null,
        })
        break
      case 'error':
        set({ errorMsg: msg.message })
        break
    }
  },
}))
