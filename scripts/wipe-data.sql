-- Deletes every team, player, session and game, but keeps the tables (the schema and applied migrations).
-- Children first, because the database enforces foreign keys.
-- Local:  npx wrangler d1 execute paqueuekame --local --file scripts/wipe-data.sql
-- Live:   back up first (see CLAUDE.md), then the same with --remote. This cannot be undone.
DELETE FROM score_events;
DELETE FROM match_players;
DELETE FROM matches;
DELETE FROM umpires;
DELETE FROM session_rsvps;
DELETE FROM session_players;
DELETE FROM sessions;
DELETE FROM places;
DELETE FROM players;
DELETE FROM logins;
DELETE FROM organizers;
DELETE FROM teams;
