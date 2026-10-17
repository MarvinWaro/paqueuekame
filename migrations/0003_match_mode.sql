-- How Up Next builds games: balanced, social, skill or winners (see shared/matchModes.ts).
ALTER TABLE sessions ADD COLUMN mode TEXT NOT NULL DEFAULT 'balanced';
