// Check-in and break/leave, shared by organizer routes and player self check-in.
import type { AttendanceStatus } from "../shared/types";
import type { Env } from "./env";
import { HttpError } from "./http";
import { ulid } from "./ids";
import { MAX_PLAYERS, activePlayerCount } from "./routes/players";
import { type Loaded, assertLive, deleteNextStatements, teamsOf } from "./state";

const MAX_ATTENDEES = 80;

/** Adds a guest to the roster (from the organizer's screen or a player's phone). */
export async function createGuest(env: Env, teamId: string, name: string, skill: number | null): Promise<string> {
  const dupe = await env.DB.prepare("SELECT 1 FROM players WHERE team_id = ? AND archived_at IS NULL AND name = ? COLLATE NOCASE")
    .bind(teamId, name)
    .first();
  if (dupe) throw new HttpError(409, `${name} is already on the list. Pick the name instead.`, "duplicate");
  if ((await activePlayerCount(env, teamId)) >= MAX_PLAYERS) {
    throw new HttpError(400, "The roster is full. Ask an organizer to remove old guests.", "too_many");
  }
  const id = ulid();
  await env.DB.prepare("INSERT INTO players (id, team_id, name, skill, is_guest, created_at) VALUES (?, ?, ?, ?, 1, ?)")
    .bind(id, teamId, name, skill, Date.now())
    .run();
  return id;
}

/** Puts a player in line. New arrivals and players back from a break join at the back. */
export async function checkIn(env: Env, loaded: Loaded, playerId: string): Promise<void> {
  assertLive(loaded);
  const player = await env.DB.prepare("SELECT name FROM players WHERE id = ? AND team_id = ? AND archived_at IS NULL")
    .bind(playerId, loaded.session.team_id)
    .first<{ name: string }>();
  if (!player) throw new HttpError(404, "That player isn't on the roster.", "not_found");

  const existing = loaded.attendees.find((a) => a.player_id === playerId);
  if (existing?.status === "in") return; // already in line; a second tap changes nothing
  if (!existing && loaded.attendees.length >= MAX_ATTENDEES) {
    throw new HttpError(400, `A session can have up to ${MAX_ATTENDEES} players.`, "too_many");
  }
  const now = Date.now();
  await env.DB.prepare(
    `INSERT INTO session_players (session_id, player_id, status, queued_at, skips, joined_at)
     VALUES (?, ?, 'in', ?, 0, ?)
     ON CONFLICT (session_id, player_id) DO UPDATE SET status = 'in', queued_at = excluded.queued_at, skips = 0`,
  )
    .bind(loaded.session.id, playerId, now, now)
    .run();
}

/** Break, leave, or back in line. A player on court has to finish the game first. */
export async function setStatus(env: Env, loaded: Loaded, playerId: string, status: AttendanceStatus): Promise<void> {
  assertLive(loaded);
  const attendee = loaded.attendees.find((a) => a.player_id === playerId);
  if (!attendee) throw new HttpError(404, "That player isn't checked in to this session.", "not_found");
  if (status === "in") return checkIn(env, loaded, playerId);
  if (attendee.status === status) return;

  const teams = teamsOf(loaded);
  const playing = loaded.matches.find((m) => m.status === "playing" && teams.get(m.id)?.team1.concat(teams.get(m.id)!.team2).includes(playerId));
  if (playing) {
    throw new HttpError(409, `${attendee.name} is playing on Court ${playing.court}. Record that game first.`, "playing");
  }
  const next = loaded.matches.find((m) => m.status === "next");
  const inNext = next && [...teams.get(next.id)!.team1, ...teams.get(next.id)!.team2].includes(playerId);

  await env.DB.batch([
    // Up Next gets rebuilt without them.
    ...(inNext ? deleteNextStatements(env, next!.id) : []),
    env.DB.prepare("UPDATE session_players SET status = ? WHERE session_id = ? AND player_id = ?").bind(
      status,
      loaded.session.id,
      playerId,
    ),
  ]);
}
