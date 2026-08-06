CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY,
  username      TEXT NOT NULL,
  username_norm TEXT NOT NULL UNIQUE,
  code_hash     TEXT NOT NULL,
  -- rating Elo et nombre de parties classées (voir config.ELO_START pour le défaut)
  elo           INTEGER NOT NULL DEFAULT 1000,
  elo_games     INTEGER NOT NULL DEFAULT 0,
  -- marque du joueur : couleur parmi avatar.COLORS (dérivée du pseudo à l'inscription),
  -- symbole parmi avatar.SYMBOLS ou NULL = initiales
  avatar_color  TEXT NOT NULL DEFAULT 'citron',
  avatar_symbol TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS quizzes (
  id         INTEGER PRIMARY KEY,
  owner_id   INTEGER NOT NULL REFERENCES users(id),
  title      TEXT NOT NULL,
  emoji      TEXT NOT NULL DEFAULT '❓',
  category   TEXT NOT NULL,
  play_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS questions (
  id            INTEGER PRIMARY KEY,
  quiz_id       INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  position      INTEGER NOT NULL,
  text          TEXT NOT NULL,
  answers       TEXT NOT NULL,
  correct_index INTEGER NOT NULL CHECK (correct_index BETWEEN 0 AND 3)
);

CREATE TABLE IF NOT EXISTS games (
  id                INTEGER PRIMARY KEY,
  code              TEXT NOT NULL,
  quiz_id           INTEGER REFERENCES quizzes(id) ON DELETE SET NULL,
  host_id           INTEGER NOT NULL REFERENCES users(id),
  question_count    INTEGER,
  time_per_question INTEGER,
  status            TEXT NOT NULL DEFAULT 'lobby',
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at       TEXT
);

CREATE TABLE IF NOT EXISTS game_players (
  game_id       INTEGER NOT NULL REFERENCES games(id),
  user_id       INTEGER NOT NULL REFERENCES users(id),
  score         INTEGER NOT NULL,
  correct_count INTEGER NOT NULL,
  rank          INTEGER NOT NULL,
  -- NULL = partie non classée (solo) ; sinon rating avant la partie et delta appliqué
  elo_before    INTEGER,
  elo_delta     INTEGER,
  PRIMARY KEY (game_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_games_code ON games(code);
CREATE INDEX IF NOT EXISTS idx_games_finished ON games(finished_at) WHERE status = 'finished';
CREATE INDEX IF NOT EXISTS idx_gp_user ON game_players(user_id);
CREATE INDEX IF NOT EXISTS idx_questions_quiz ON questions(quiz_id, position);
