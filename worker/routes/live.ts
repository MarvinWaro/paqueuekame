// Public routes for players: the live board (view only) and self check-in from the court QR.
import type { CheckinRoster, Player } from "../../shared/types";
import { checkIn, createGuest, setStatus } from "../actions";
import type { Env } from "../env";
import { HttpError, json, readJson } from "../http";
import type { Router } from "../router";
import { buildState, freshState, loadSession } from "../state";
import { selfCheckinSchema, selfStatusSchema } from "../validate";

interface LiveRow {
  id: string;
  team_id: string;
  title: string;
  status: "live" | "ended";
  checkin_token: string;
  self_checkin: number;
}

async function findLive(env: Env, token: string): Promise<LiveRow> {
  const row = await env.DB.prepare(
    "SELECT id, team_id, title, status, checkin_token, self_checkin FROM sessions WHERE live_token = ?",
  )
    .bind(token)
    .first<LiveRow>();
  if (!row) throw new HttpError(404, "This link doesn't match a session. Ask your organizer for the new one.", "not_found");
  return row;
}

/** Self check-in needs the token from the QR code at the court, not just the shared live link. */
function assertCheckinAllowed(row: LiveRow, k: string | null): void {
  if (row.status !== "live") throw new HttpError(409, "This session has ended.", "session_ended");
  if (!row.self_checkin) throw new HttpError(403, "Self check-in is off. Ask an organizer to check you in.", "self_checkin_off");
  if (!k || k !== row.checkin_token) {
    throw new HttpError(403, "This check-in code is old or wrong. Scan the QR code at the court again.", "bad_checkin_code");
  }
}

export function liveRoutes(router: Router): void {
  router.get("/api/live/:token", async ({ env, params }) => {
    const row = await findLive(env, params.token);
    // Read-only: players polling the board never write to the database.
    return json(buildState(await loadSession(env, row.id), false));
  });

  router.get("/api/live/:token/roster", async ({ env, params, url }) => {
    const row = await findLive(env, params.token);
    assertCheckinAllowed(row, url.searchParams.get("k"));
    const [team, players] = await env.DB.batch([
      env.DB.prepare("SELECT name FROM teams WHERE id = ?").bind(row.team_id),
      env.DB.prepare(
        "SELECT id, name, skill, is_guest FROM players WHERE team_id = ? AND archived_at IS NULL ORDER BY name COLLATE NOCASE",
      ).bind(row.team_id),
    ]);
    const roster: CheckinRoster = {
      teamName: (team.results[0] as { name: string }).name,
      sessionTitle: row.title,
      players: (players.results as { id: string; name: string; skill: number | null; is_guest: number }[]).map(
        (p): Player => ({ id: p.id, name: p.name, skill: p.skill, isGuest: p.is_guest === 1 }),
      ),
    };
    return json(roster);
  });

  router.post("/api/live/:token/checkin", async ({ env, req, params }) => {
    const body = await readJson(req, selfCheckinSchema);
    const row = await findLive(env, params.token);
    assertCheckinAllowed(row, body.k);
    if (!body.playerId && !body.name) throw new HttpError(400, "Pick your name or type it.", "invalid_input");
    const playerId = body.playerId ?? (await createGuest(env, row.team_id, body.name!, null));
    await checkIn(env, await loadSession(env, row.id), playerId);
    return json({ playerId, state: await freshState(env, row.id, false) });
  });

  router.post("/api/live/:token/status", async ({ env, req, params }) => {
    const body = await readJson(req, selfStatusSchema);
    const row = await findLive(env, params.token);
    assertCheckinAllowed(row, body.k);
    await setStatus(env, await loadSession(env, row.id), body.playerId, body.status);
    return json(await freshState(env, row.id, false));
  });
}
