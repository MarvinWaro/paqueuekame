-- Members who tapped "I'm coming" from the group-chat link. They're not in line until they check in at the court
-- (court QR or the organizer), so people still at home can't hold a place ahead of people already there.
CREATE TABLE session_rsvps (
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  player_id  TEXT NOT NULL REFERENCES players(id),
  created_at INTEGER NOT NULL,
  PRIMARY KEY (session_id, player_id)
);

CREATE TRIGGER session_rsvps_ins AFTER INSERT ON session_rsvps
BEGIN UPDATE sessions SET version = version + 1 WHERE id = NEW.session_id; END;
CREATE TRIGGER session_rsvps_del AFTER DELETE ON session_rsvps
BEGIN UPDATE sessions SET version = version + 1 WHERE id = OLD.session_id; END;
