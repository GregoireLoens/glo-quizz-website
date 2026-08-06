import type { AvatarColor, AvatarSymbol } from './avatar'

// ---------- REST ----------

/** Marque du joueur, servie partout où un avatar s'affiche. `avatarSymbol` à null = initiales. */
export interface Avatar {
  avatarColor: AvatarColor
  avatarSymbol: AvatarSymbol | null
}

export interface User extends Avatar {
  id: number
  username: string
}

export interface AuthResponse {
  token: string
  user: User
  code?: string
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

export interface LeaderboardEntry extends Avatar {
  rank: number
  userId: number
  username: string
  gamesPlayed: number
  elo: number
  eloDelta: number | null // progression sur la période (null sur « Depuis toujours »)
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
  survival: boolean
  categories: string[] | null // modes Aléatoire/Survie : thèmes autorisés (null = tous)
}

export interface GamePlayer extends Avatar {
  id: number
  username: string
  ready: boolean
  connected: boolean
  score: number
  correctCount: number
  lives: number
  answered: boolean
}

export interface GameQuestion {
  index: number
  total: number | null // null en mode Survie (nombre de questions inconnu d'avance)
  text: string
  answers: string[]
  theme: string | null // titre du quiz d'origine (modes Aléatoire/Survie), sinon null
  duration: number
  elapsed?: number
}

export interface RevealResult {
  playerId: number
  answerIndex: number | null
  correct: boolean
  pointsEarned: number
  score: number
  lives: number
}

export interface RankingEntry extends Avatar {
  rank: number
  playerId: number
  username: string
  score: number
  correctCount: number
  lives: number
  // Renseignés sur le classement final uniquement, et null si la partie n'est pas
  // classée (partie solo) — absents des classements intermédiaires.
  eloBefore?: number | null
  eloDelta?: number | null
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
  questionsPlayed: number | null
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
  | { type: 'game_over'; durationSec: number; questionsPlayed: number; ranking: RankingEntry[] }
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
