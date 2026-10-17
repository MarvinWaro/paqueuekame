-- A change counter per session. Phones polling the board send the version they have;
-- if it hasn't changed, the server answers from this one row instead of reading the whole session.
ALTER TABLE sessions ADD COLUMN version INTEGER NOT NULL DEFAULT 0;

CREATE TRIGGER session_players_ins AFTER INSERT ON session_players
BEGIN UPDATE sessions SET version = version + 1 WHERE id = NEW.session_id; END;
CREATE TRIGGER session_players_upd AFTER UPDATE ON session_players
BEGIN UPDATE sessions SET version = version + 1 WHERE id = NEW.session_id; END;

CREATE TRIGGER matches_ins AFTER INSERT ON matches
BEGIN UPDATE sessions SET version = version + 1 WHERE id = NEW.session_id; END;
CREATE TRIGGER matches_upd AFTER UPDATE ON matches
BEGIN UPDATE sessions SET version = version + 1 WHERE id = NEW.session_id; END;
CREATE TRIGGER matches_del AFTER DELETE ON matches
BEGIN UPDATE sessions SET version = version + 1 WHERE id = OLD.session_id; END;

-- Swapping a player in Up Next only touches match_players.
CREATE TRIGGER match_players_upd AFTER UPDATE OF player_id ON match_players
BEGIN UPDATE sessions SET version = version + 1 WHERE id = (SELECT session_id FROM matches WHERE id = NEW.match_id); END;
