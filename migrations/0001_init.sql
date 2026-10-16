-- PaQueueKame: open-play queue for a pickleball team.
-- IDs are ULIDs, times are UTC milliseconds.

CREATE TABLE teams (
  id         TEXT PRIMARY KEY,
  slug       TEXT NOT NULL UNIQUE,
  name       TEXT NOT NULL,
  timezone   TEXT NOT NULL DEFAULT 'Asia/Manila',
  created_at INTEGER NOT NULL
);

-- People who run sessions. Players don't log in.
CREATE TABLE organizers (
  id            TEXT PRIMARY KEY,
  team_id       TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  failed_logins INTEGER NOT NULL DEFAULT 0,
  locked_until  INTEGER NOT NULL DEFAULT 0,
  created_at    INTEGER NOT NULL
);
CREATE INDEX idx_organizers_team ON organizers(team_id);

-- Login sessions (the cookie holds the token; only its SHA-256 is stored).
CREATE TABLE logins (
  token_hash   TEXT PRIMARY KEY,
  organizer_id TEXT NOT NULL REFERENCES organizers(id) ON DELETE CASCADE,
  expires_at   INTEGER NOT NULL,
  created_at   INTEGER NOT NULL
);
CREATE INDEX idx_logins_organizer ON logins(organizer_id);

-- The team roster. Archived players stay so old games keep their names.
CREATE TABLE players (
  id          TEXT PRIMARY KEY,
  team_id     TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  skill       INTEGER CHECK (skill BETWEEN 1 AND 6),   -- optional, 1 = beginner, 6 = expert
  is_guest    INTEGER NOT NULL DEFAULT 0,
  archived_at INTEGER,
  created_at  INTEGER NOT NULL
);
CREATE INDEX idx_players_team ON players(team_id, archived_at);

-- One open-play session (one day at one venue).
CREATE TABLE sessions (
  id            TEXT PRIMARY KEY,
  team_id       TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  venue         TEXT,
  court_count   INTEGER NOT NULL CHECK (court_count BETWEEN 1 AND 12),
  status        TEXT NOT NULL DEFAULT 'live' CHECK (status IN ('live', 'ended')),
  live_token    TEXT NOT NULL UNIQUE,   -- public, view-only link for players
  checkin_token TEXT NOT NULL,          -- only inside the court QR; lets players check themselves in
  self_checkin  INTEGER NOT NULL DEFAULT 1,
  created_at    INTEGER NOT NULL,
  ended_at      INTEGER
);
CREATE INDEX idx_sessions_team ON sessions(team_id, created_at);

-- Who is at a session and their place in line.
CREATE TABLE session_players (
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  player_id  TEXT NOT NULL REFERENCES players(id),
  status     TEXT NOT NULL CHECK (status IN ('in', 'break', 'left')),
  queued_at  INTEGER NOT NULL,          -- check-in time, or when their last game ended
  skips      INTEGER NOT NULL DEFAULT 0, -- times someone who waited less went ahead of them
  joined_at  INTEGER NOT NULL,
  PRIMARY KEY (session_id, player_id)
);
CREATE INDEX idx_session_players_player ON session_players(player_id);

CREATE TABLE matches (
  id         TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  status     TEXT NOT NULL CHECK (status IN ('next', 'playing', 'done', 'cancelled')),
  court      INTEGER,                    -- set when the game starts
  winner     INTEGER CHECK (winner IN (1, 2)),
  score1     INTEGER,
  score2     INTEGER,
  created_at INTEGER NOT NULL,
  started_at INTEGER,
  ended_at   INTEGER
);
CREATE INDEX idx_matches_session ON matches(session_id, status);
-- At most one Up Next match per session, and one game per court.
CREATE UNIQUE INDEX uniq_matches_next ON matches(session_id) WHERE status = 'next';
CREATE UNIQUE INDEX uniq_matches_court ON matches(session_id, court) WHERE status = 'playing';

CREATE TABLE match_players (
  match_id       TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  player_id      TEXT NOT NULL REFERENCES players(id),
  team           INTEGER NOT NULL CHECK (team IN (1, 2)),
  prev_queued_at INTEGER,                -- place in line before the result, for Undo
  PRIMARY KEY (match_id, player_id)
);
CREATE INDEX idx_match_players_player ON match_players(player_id);
