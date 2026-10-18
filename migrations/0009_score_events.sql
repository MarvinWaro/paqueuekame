-- The umpire's log becomes a general event log: rallies plus corrections (make a player the server,
-- swap a team's sides). The score is still worked out from it (shared/sideout.ts), never sent by a phone.
CREATE TABLE score_events (
  match_id   TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  seq        INTEGER NOT NULL,
  kind       TEXT NOT NULL DEFAULT 'rally' CHECK (kind IN ('rally', 'server', 'swap')),
  winner     INTEGER CHECK (winner IN (1, 2)),     -- rally: the team that won it
  player_id  TEXT,                                 -- server: who serves now
  server_no  INTEGER CHECK (server_no IN (1, 2)),  -- server: as 1st or 2nd server
  team       INTEGER CHECK (team IN (1, 2)),       -- swap: whose players change sides
  created_at INTEGER NOT NULL,
  PRIMARY KEY (match_id, seq),
  CHECK ((kind = 'rally' AND winner IS NOT NULL)
      OR (kind = 'server' AND player_id IS NOT NULL AND server_no IS NOT NULL)
      OR (kind = 'swap' AND team IS NOT NULL))
);
INSERT INTO score_events (match_id, seq, kind, winner, created_at)
SELECT match_id, seq, 'rally', winner, created_at FROM rallies;
DROP TABLE rallies; -- its version triggers go with it

CREATE TRIGGER score_events_ins AFTER INSERT ON score_events
BEGIN UPDATE sessions SET version = version + 1 WHERE id = (SELECT session_id FROM matches WHERE id = NEW.match_id); END;
CREATE TRIGGER score_events_del AFTER DELETE ON score_events
BEGIN UPDATE sessions SET version = version + 1 WHERE id = (SELECT session_id FROM matches WHERE id = OLD.match_id); END;

-- Each team's base player: the one who starts on the right (even) side. NULL = the first player listed.
ALTER TABLE matches ADD COLUMN base1 TEXT REFERENCES players(id);
ALTER TABLE matches ADD COLUMN base2 TEXT REFERENCES players(id);
