-- Places a team plays at (e.g. "AEON court"). Each session points at one, so stats can be filtered by place.
CREATE TABLE places (
  id          TEXT PRIMARY KEY,
  team_id     TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  court_count INTEGER NOT NULL DEFAULT 2 CHECK (court_count BETWEEN 1 AND 12), -- fills in "Courts booked"
  archived_at INTEGER,                                                        -- hidden from pickers; old sessions keep the name
  created_at  INTEGER NOT NULL
);
CREATE UNIQUE INDEX uniq_places_name ON places(team_id, name COLLATE NOCASE);

ALTER TABLE sessions ADD COLUMN place_id TEXT REFERENCES places(id);
CREATE INDEX idx_sessions_place ON sessions(place_id, created_at);

-- Turn each venue typed into past sessions into a place (same name, ignoring case and spaces).
-- IDs are ULIDs: 10 characters from the first session's time, then 16 random ones.
WITH venues AS (
  SELECT team_id, MIN(trim(venue)) AS name, MAX(court_count) AS courts, MIN(created_at) AS t
  FROM sessions
  WHERE trim(COALESCE(venue, '')) != ''
  GROUP BY team_id, lower(trim(venue))
),
b32(c) AS (SELECT '0123456789ABCDEFGHJKMNPQRSTVWXYZ')
INSERT INTO places (id, team_id, name, court_count, created_at)
SELECT
  substr(c, ((t >> 45) & 31) + 1, 1) || substr(c, ((t >> 40) & 31) + 1, 1) || substr(c, ((t >> 35) & 31) + 1, 1) ||
  substr(c, ((t >> 30) & 31) + 1, 1) || substr(c, ((t >> 25) & 31) + 1, 1) || substr(c, ((t >> 20) & 31) + 1, 1) ||
  substr(c, ((t >> 15) & 31) + 1, 1) || substr(c, ((t >> 10) & 31) + 1, 1) || substr(c, ((t >> 5) & 31) + 1, 1) ||
  substr(c, (t & 31) + 1, 1) ||
  substr(c, abs(random() % 32) + 1, 1) || substr(c, abs(random() % 32) + 1, 1) || substr(c, abs(random() % 32) + 1, 1) ||
  substr(c, abs(random() % 32) + 1, 1) || substr(c, abs(random() % 32) + 1, 1) || substr(c, abs(random() % 32) + 1, 1) ||
  substr(c, abs(random() % 32) + 1, 1) || substr(c, abs(random() % 32) + 1, 1) || substr(c, abs(random() % 32) + 1, 1) ||
  substr(c, abs(random() % 32) + 1, 1) || substr(c, abs(random() % 32) + 1, 1) || substr(c, abs(random() % 32) + 1, 1) ||
  substr(c, abs(random() % 32) + 1, 1) || substr(c, abs(random() % 32) + 1, 1) || substr(c, abs(random() % 32) + 1, 1) ||
  substr(c, abs(random() % 32) + 1, 1),
  team_id, name, courts, t
FROM venues, b32;

UPDATE sessions
SET place_id = (SELECT p.id FROM places p WHERE p.team_id = sessions.team_id AND p.name = trim(sessions.venue) COLLATE NOCASE)
WHERE trim(COALESCE(venue, '')) != '';

-- The place now holds the name.
ALTER TABLE sessions DROP COLUMN venue;
