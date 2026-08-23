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

/** `fifty` sécurise, `double` parie, `steal` agresse, `shield` pare — voir lib/jokers.ts
 * pour les libellés et l'écran de règles. */
export type JokerKind = 'fifty' | 'double' | 'steal' | 'shield'

/** État des jokers du joueur sur la question en cours, rejoué à chaque (re)connexion. */
export interface JokerState {
  hidden: number[] // réponses masquées par le moitié-moitié
  double: boolean
  stealTarget: number | null // braquage armé sur ce joueur (null = aucun)
  shield: boolean // bouclier posé sur la question en cours
}

export interface GameSettings {
  questionCount: number
  timePerQuestion: number
  quizId: number | null
  quizTitle: string | null
  quizQuestionTotal: number | null
  randomMix: boolean
  survival: boolean
  categories: string[] | null // modes Aléatoire/Survie : thèmes autorisés (null = tous)
  jokers: boolean // quatre jokers par joueur ; l'hôte peut couper le système
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
  /** Jokers encore en main — publics : savoir ce qu'il reste aux autres fait partie du jeu. */
  jokers: JokerKind[]
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
  /** Ce joueur avait engagé un « double ou rien » — sans quoi un −1 en bonnes réponses
   * serait incompréhensible pour les autres. */
  doubled: boolean
  /** Vies réellement perdues sur cette question (0 hors Survie). Vient du serveur : le
   * client ne rejoue pas la règle du coût d'un pari perdu. */
  livesLost: number
  /** Braquage abouti : à qui ce joueur a pris sa bonne réponse, et par qui il s'est fait
   * prendre la sienne. Null de part et d'autre quand rien ne s'est produit. */
  stoleFrom: number | null
  stolenBy: number | null
  /** Ce joueur avait posé son bouclier sur cette question. Public seulement au reveal :
   * annoncé plus tôt, le bouclier ne serait qu'un panneau « ne m'attaquez pas ». */
  shielded: boolean
  /** Braquage annulé par le bouclier de ce joueur — l'assaillant perd le sien quand même. */
  stealBlocked: number | null
  /** Braquage qui ne s'est pas déclenché : la cible n'avait rien en main, ou on avait
   * trouvé soi-même. Toujours annoncé — un braquage silencieux passait pour cassé. */
  stealMissed: 'target_wrong' | 'self_correct' | null
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
  jokerState: JokerState | null
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
  // Privé : seules deux **mauvaises** réponses sont nommées, jamais la bonne.
  | { type: 'joker_hidden'; questionIndex: number; hidden: number[] }
  // Diffusé : tout le monde voit qui dépense quoi, c'est ce qui rend le système lisible.
  | { type: 'joker_used'; playerId: number; kind: JokerKind; targetId: number | null }
  | { type: 'error'; code: string; message: string }

export type ClientMessage =
  | { type: 'auth'; token: string }
  | { type: 'ready'; ready: boolean }
  | { type: 'update_settings'; settings: Partial<GameSettings> }
  | { type: 'start' }
  | { type: 'answer'; questionIndex: number; answerIndex: number }
  | { type: 'joker'; kind: JokerKind; targetId?: number }
  | { type: 'play_again' }
  | { type: 'leave' }

// ---------- profil (`GET /api/me`) ----------

export interface ProfileGame {
  gameId: number
  finishedAt: string | null
  /** null sur un Mix aléatoire, une partie en Survie, ou un quiz retiré du catalogue. */
  quizTitle: string | null
  quizEmoji: string | null
  rank: number
  playerCount: number
  score: number
  correctCount: number
  questionCount: number | null
  eloBefore: number | null
  eloDelta: number | null
}

export interface Profile {
  elo: number
  eloGames: number
  /** null tant qu'aucune partie classée n'a été jouée. */
  rank: number | null
  rankedPlayers: number
  stats: {
    games: number
    wins: number
    ratedGames: number
    correctCount: number
    questionCount: number
  }
  games: ProfileGame[]
}
