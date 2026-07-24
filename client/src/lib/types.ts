// ---------- REST ----------

export interface User {
  id: number
  username: string
}

export interface AuthResponse {
  token: string
  user: User
  code?: string
}

export interface QuestionInput {
  text: string
  answers: string[]
  correctIndex: number
}

export interface QuizSummary {
  id: number
  title: string
  emoji: string
  category: string
  questionCount: number
  playCount: number
  author: User
}

export interface QuizDetail extends QuizSummary {
  questions: QuestionInput[]
}

export interface LeaderboardEntry {
  rank: number
  userId: number
  username: string
  gamesPlayed: number
  totalPoints: number
}

export interface LeaderboardResponse {
  entries: LeaderboardEntry[]
  me: LeaderboardEntry | null
}

export interface GameInfo {
  code: string
  status: string
  playerCount: number
  joinable: boolean
}

// ---------- Partie / WebSocket ----------

export type GamePhase = 'lobby' | 'question' | 'reveal' | 'finished'

export interface GameSettings {
  questionCount: number
  timePerQuestion: number
  quizId: number | null
  quizTitle: string | null
  quizQuestionTotal: number | null
  randomMix: boolean
}

export interface GamePlayer {
  id: number
  username: string
  ready: boolean
  connected: boolean
  score: number
  correctCount: number
  answered: boolean
}

export interface GameQuestion {
  index: number
  total: number
  text: string
  answers: string[]
  duration: number
  elapsed?: number
}

export interface RevealResult {
  playerId: number
  answerIndex: number | null
  correct: boolean
  pointsEarned: number
  score: number
}

export interface RankingEntry {
  rank: number
  playerId: number
  username: string
  score: number
  correctCount: number
}

export interface GameStateSnapshot {
  phase: GamePhase
  hostId: number
  players: GamePlayer[]
  settings: GameSettings
  question: GameQuestion | null
  reveal: RevealMessage | null
  ranking: RankingEntry[] | null
  yourAnswer: number | null
  durationSec: number
}

export interface RevealMessage {
  type: 'reveal'
  questionIndex: number
  correctIndex: number
  results: RevealResult[]
  ranking: RankingEntry[]
}

export type ServerMessage =
  | { type: 'joined'; you: { id: number }; state: GameStateSnapshot }
  | { type: 'players'; players: GamePlayer[]; hostId: number }
  | { type: 'settings_updated'; settings: GameSettings }
  | ({ type: 'question' } & GameQuestion)
  | { type: 'answer_ack'; questionIndex: number }
  | { type: 'player_answered'; playerId: number }
  | RevealMessage
  | { type: 'game_over'; durationSec: number; ranking: RankingEntry[] }
  | { type: 'lobby_reset'; players: GamePlayer[]; settings: GameSettings; hostId: number }
  | { type: 'error'; code: string; message: string }

export type ClientMessage =
  | { type: 'auth'; token: string }
  | { type: 'ready'; ready: boolean }
  | { type: 'update_settings'; settings: Partial<GameSettings> }
  | { type: 'start' }
  | { type: 'answer'; questionIndex: number; answerIndex: number }
  | { type: 'play_again' }
  | { type: 'leave' }
