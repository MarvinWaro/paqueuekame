-- Umpires: someone at the session (a player who's done for the day, or a guest) who scores games from their phone.
-- An umpire link can only score; the line, Up Next and check-in stay with organizers.
CREATE TABLE umpires (
  id         TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  player_id  TEXT NOT NULL REFERENCES players(id),
  token      TEXT NOT NULL UNIQUE,   -- inside the umpire's link; only ever sent to organizers
  created_at INTEGER NOT NULL,
  revoked_at INTEGER
);
CREATE UNIQUE INDEX uniq_umpires_active ON umpires(session_id, player_id) WHERE revoked_at IS NULL;

-- Live scoring of a game on court: who served first, and which umpire is scoring it.
ALTER TABLE matches ADD COLUMN first_server INTEGER CHECK (first_server IN (1, 2));
ALTER TABLE matches ADD COLUMN umpire_id TEXT REFERENCES umpires(id);

-- One row per rally: which team won it. The score is worked out from these (shared/sideout.ts), never sent by a phone.
CREATE TABLE rallies (
  match_id   TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  seq        INTEGER NOT NULL,
  winner     INTEGER NOT NULL CHECK (winner IN (1, 2)),
  created_at INTEGER NOT NULL,
  PRIMARY KEY (match_id, seq)
);

CREATE TRIGGER rallies_ins AFTER INSERT ON rallies
BEGIN UPDATE sessions SET version = version + 1 WHERE id = (SELECT session_id FROM matches WHERE id = NEW.match_id); END;
CREATE TRIGGER rallies_del AFTER DELETE ON rallies
BEGIN UPDATE sessions SET version = version + 1 WHERE id = (SELECT session_id FROM matches WHERE id = OLD.match_id); END;
CREATE TRIGGER umpires_ins AFTER INSERT ON umpires
BEGIN UPDATE sessions SET version = version + 1 WHERE id = NEW.session_id; END;
CREATE TRIGGER umpires_upd AFTER UPDATE ON umpires
BEGIN UPDATE sessions SET version = version + 1 WHERE id = NEW.session_id; END;
