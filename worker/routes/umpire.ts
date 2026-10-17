// Public routes for umpires. An umpire link can score games on court and nothing else:
// no starting games, swaps, check-in, cancel or undo. The score always comes from the rally log.
import type { UmpireState } from "../../shared/types";
import { recordResult } from "../actions";
import type { Env } from "../env";
import { HttpError, json, readJson } from "../http";
import type { Router } from "../router";
import { type Loaded, assertLive, buildState, liveScoreOf, loadSession, refillNext, sentVersion, unchanged } from "../state";
import { rallySchema, umpStartSchema, undoRallySchema } from "../validate";

interface UmpireLink {
  id: string;
  session_id: string;
  name: string;
  revoked_at: number | null;
  version: number;
}

async function findUmpire(env: Env, token: string): Promise<UmpireLink> {
  const row = await env.DB.prepare(
    `SELECT u.id, u.session_id, u.revoked_at, p.name, s.version
     FROM umpires u JOIN players p ON p.id = u.player_id JOIN sessions s ON s.id = u.session_id
     WHERE u.token = ?`,
  )
    .bind(token)
    .first<UmpireLink>();
  if (!row) throw new HttpError(404, "This umpire link doesn't work. Ask the organizer for a new one.", "not_found");
  if (row.revoked_at) throw new HttpError(403, "The organizer turned this umpire link off.", "revoked");
  return row;
}

function umpireState(loaded: Loaded, ump: UmpireLink): UmpireState {
  const state = buildState(loaded, false);
  return {
    version: state.version,
    umpire: { id: ump.id, name: ump.name },
    teamName: state.teamName,
    sessionTitle: loaded.session.title,
    status: loaded.session.status,
    courtColors: state.courtColors,
    courts: state.courts,
    serverTime: state.serverTime,
  };
}

/** After a change: refill Up Next (a result frees players), then answer with the umpire's view. */
async function freshUmpireState(env: Env, ump: UmpireLink): Promise<UmpireState> {
  let loaded = await loadSession(env, ump.session_id);
  if (await refillNext(env, loaded)) loaded = await loadSession(env, ump.session_id);
  return umpireState(loaded, ump);
}

/** The umpire, the session (live) and the game on court they want to score. */
async function target(env: Env, token: string, matchId: string) {
  const ump = await findUmpire(env, token);
  const loaded = await loadSession(env, ump.session_id);
  assertLive(loaded);
  const match = loaded.matches.find((m) => m.id === matchId);
  if (!match || match.status !== "playing") throw new HttpError(409, "This game isn't on court anymore.", "not_playing");
  return { ump, loaded, match };
}

/** Only the umpire who started scoring a game can add to it (anyone can take over from the start screen). */
function assertScoring(t: Awaited<ReturnType<typeof target>>) {
  const live = liveScoreOf(t.loaded, t.match);
  if (!live) throw new HttpError(409, "Pick who serves first to start scoring.", "not_started");
  if (t.match.umpire_id !== t.ump.id) {
    const other = t.loaded.umpires.find((u) => u.id === t.match.umpire_id)?.name ?? "Another umpire";
    throw new HttpError(409, `${other} is scoring Court ${t.match.court}. Tap Take over if they've stopped.`, "claimed");
  }
  return live;
}

const claimed = "EXISTS (SELECT 1 FROM matches WHERE id = ? AND status = 'playing' AND umpire_id = ?)";

export function umpireRoutes(router: Router): void {
  router.get("/api/ump/:token", async ({ env, params, url }) => {
    const ump = await findUmpire(env, params.token);
    const v = sentVersion(url);
    if (v !== null && v === ump.version) return json(unchanged(ump.version));
    return json(umpireState(await loadSession(env, ump.session_id), ump)); // read-only
  });

  /** Claims a game and sets who serves first (only before the first rally). */
  router.post("/api/ump/:token/matches/:matchId/start", async ({ env, req, params }) => {
    const body = await readJson(req, umpStartSchema);
    const { ump, loaded, match } = await target(env, params.token, params.matchId);
    if (match.umpire_id && match.umpire_id !== ump.id && !body.force) {
      const other = loaded.umpires.find((u) => u.id === match.umpire_id)?.name ?? "Another umpire";
      throw new HttpError(409, `${other} is scoring Court ${match.court}. Tap Take over if they've stopped.`, "claimed");
    }
    await env.DB.prepare(
      `UPDATE matches SET umpire_id = ?,
         first_server = CASE WHEN EXISTS (SELECT 1 FROM rallies WHERE match_id = ?) THEN first_server ELSE ? END
       WHERE id = ? AND status = 'playing'`,
    )
      .bind(ump.id, match.id, body.firstServer, match.id)
      .run();
    return json(await freshUmpireState(env, ump));
  });

  router.post("/api/ump/:token/matches/:matchId/rally", async ({ env, req, params }) => {
    const body = await readJson(req, rallySchema);
    const t = await target(env, params.token, params.matchId);
    const live = assertScoring(t);
    if (live.winner) throw new HttpError(409, "The game is over. Save the result, or undo the last rally.", "game_over");
    // Counted only if the phone saw the latest score, so a double tap can't add the same rally twice.
    await env.DB.prepare(
      `INSERT INTO rallies (match_id, seq, winner, created_at)
       SELECT ?, ?, ?, ? WHERE ? = (SELECT COUNT(*) FROM rallies WHERE match_id = ?) AND ${claimed}`,
    )
      .bind(t.match.id, body.seq, body.winner, Date.now(), body.seq, t.match.id, t.match.id, t.ump.id)
      .run();
    return json(await freshUmpireState(env, t.ump));
  });

  router.post("/api/ump/:token/matches/:matchId/undo", async ({ env, req, params }) => {
    const body = await readJson(req, undoRallySchema);
    const t = await target(env, params.token, params.matchId);
    assertScoring(t);
    await env.DB.prepare(
      `DELETE FROM rallies WHERE match_id = ? AND seq = ?
         AND seq = (SELECT MAX(seq) FROM rallies WHERE match_id = ?) AND ${claimed}`,
    )
      .bind(t.match.id, body.seq, t.match.id, t.match.id, t.ump.id)
      .run();
    return json(await freshUmpireState(env, t.ump));
  });

  /** Saves the result once a team has won: the score comes from the rallies, not the phone. */
  router.post("/api/ump/:token/matches/:matchId/finish", async ({ env, params }) => {
    const t = await target(env, params.token, params.matchId);
    const live = assertScoring(t);
    if (!live.winner) {
      throw new HttpError(409, "The game isn't over yet. A team needs 11 points and a 2-point lead.", "not_over");
    }
    await recordResult(env, t.loaded.session.id, t.match.id, live.winner, live.score1, live.score2);
    return json(await freshUmpireState(env, t.ump));
  });
}
