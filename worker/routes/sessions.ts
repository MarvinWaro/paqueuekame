// Organizer routes for running a session: courts, Up Next, results.
import type { SessionSummary } from "../../shared/types";
import { checkIn, createGuest, setStatus } from "../actions";
import { requireOrganizer } from "../auth";
import { HttpError, json, readJson } from "../http";
import { randomToken, ulid } from "../ids";
import { matchKey, passedOver } from "../queue";
import type { Router } from "../router";
import { assertLive, busyPlayers, deleteNextStatements, freshState, loadOwnSession, teamsOf } from "../state";
import {
  checkinSchema,
  createSessionSchema,
  resultSchema,
  startSchema,
  statusSchema,
  swapSchema,
  updateSessionSchema,
} from "../validate";

const UNDO_MINUTES = 15;

interface SummaryRow {
  id: string;
  title: string;
  venue: string | null;
  court_count: number;
  status: "live" | "ended";
  created_at: number;
  ended_at: number | null;
  player_count: number;
  game_count: number;
}

const toSummary = (r: SummaryRow): SessionSummary => ({
  id: r.id,
  title: r.title,
  venue: r.venue,
  courtCount: r.court_count,
  status: r.status,
  createdAt: r.created_at,
  endedAt: r.ended_at,
  playerCount: r.player_count,
  gameCount: r.game_count,
});

export function sessionRoutes(router: Router): void {
  router.get("/api/sessions", async ({ env, req }) => {
    const { team } = await requireOrganizer(env, req);
    const { results } = await env.DB.prepare(
      `SELECT s.id, s.title, s.venue, s.court_count, s.status, s.created_at, s.ended_at,
         (SELECT COUNT(*) FROM session_players sp WHERE sp.session_id = s.id) AS player_count,
         (SELECT COUNT(*) FROM matches m WHERE m.session_id = s.id AND m.status = 'done') AS game_count
       FROM sessions s WHERE s.team_id = ? ORDER BY s.created_at DESC LIMIT 50`,
    )
      .bind(team.id)
      .all<SummaryRow>();
    return json(results.map(toSummary));
  });

  router.post("/api/sessions", async ({ env, req }) => {
    const { team } = await requireOrganizer(env, req);
    const body = await readJson(req, createSessionSchema);
    const live = await env.DB.prepare("SELECT id FROM sessions WHERE team_id = ? AND status = 'live'").bind(team.id).first<{ id: string }>();
    if (live) throw new HttpError(409, "A session is already running. End it before starting a new one.", "already_live");
    const id = ulid();
    await env.DB.prepare(
      `INSERT INTO sessions (id, team_id, title, venue, court_count, live_token, checkin_token, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(id, team.id, body.title, body.venue ?? null, body.courtCount, randomToken(9), randomToken(12), Date.now())
      .run();
    return json(await freshState(env, id, true), 201);
  });

  router.get("/api/sessions/:id", async ({ env, req, params }) => {
    const { team } = await requireOrganizer(env, req);
    await loadOwnSession(env, params.id, team.id);
    return json(await freshState(env, params.id, true));
  });

  router.patch("/api/sessions/:id", async ({ env, req, params }) => {
    const { team } = await requireOrganizer(env, req);
    const body = await readJson(req, updateSessionSchema);
    const { session } = await loadOwnSession(env, params.id, team.id);
    await env.DB.prepare("UPDATE sessions SET title = ?, venue = ?, court_count = ?, self_checkin = ? WHERE id = ?")
      .bind(
        body.title ?? session.title,
        body.venue === undefined ? session.venue : body.venue,
        body.courtCount ?? session.court_count,
        body.selfCheckin === undefined ? session.self_checkin : body.selfCheckin ? 1 : 0,
        session.id,
      )
      .run();
    return json(await freshState(env, session.id, true));
  });

  /** Ends the session. Games still on court are cancelled and don't count. */
  router.post("/api/sessions/:id/end", async ({ env, req, params }) => {
    const { team } = await requireOrganizer(env, req);
    const loaded = await loadOwnSession(env, params.id, team.id);
    assertLive(loaded);
    const now = Date.now();
    const next = loaded.matches.find((m) => m.status === "next");
    await env.DB.batch([
      ...(next ? deleteNextStatements(env, next.id) : []),
      env.DB.prepare("UPDATE matches SET status = 'cancelled', ended_at = ? WHERE session_id = ? AND status = 'playing'").bind(now, params.id),
      env.DB.prepare("UPDATE sessions SET status = 'ended', ended_at = ? WHERE id = ? AND status = 'live'").bind(now, params.id),
    ]);
    return json(await freshState(env, params.id, true));
  });

  router.post("/api/sessions/:id/checkin", async ({ env, req, params }) => {
    const { team } = await requireOrganizer(env, req);
    const body = await readJson(req, checkinSchema);
    const loaded = await loadOwnSession(env, params.id, team.id);
    assertLive(loaded);
    const playerId = "playerId" in body ? body.playerId : await createGuest(env, team.id, body.name, body.skill ?? null);
    await checkIn(env, loaded, playerId);
    return json(await freshState(env, params.id, true));
  });

  router.post("/api/sessions/:id/players/:playerId/status", async ({ env, req, params }) => {
    const { team } = await requireOrganizer(env, req);
    const body = await readJson(req, statusSchema);
    const loaded = await loadOwnSession(env, params.id, team.id);
    await setStatus(env, loaded, params.playerId, body.status);
    return json(await freshState(env, params.id, true));
  });

  /** Sends the Up Next match to a free court. */
  router.post("/api/sessions/:id/next/start", async ({ env, req, params }) => {
    const { team } = await requireOrganizer(env, req);
    const body = await readJson(req, startSchema);
    const loaded = await loadOwnSession(env, params.id, team.id);
    assertLive(loaded);
    const next = loaded.matches.find((m) => m.status === "next");
    if (!next) throw new HttpError(409, "There's no Up Next game yet. Check in at least 4 players.", "no_next");
    if (body.court > loaded.session.court_count) {
      throw new HttpError(400, `This session has ${loaded.session.court_count} courts.`, "bad_court");
    }
    if (loaded.matches.some((m) => m.status === "playing" && m.court === body.court)) {
      throw new HttpError(409, `Court ${body.court} still has a game. Record its result first.`, "court_busy");
    }

    // Who got passed over: line order including the Up Next players, minus anyone on court.
    const teams = teamsOf(loaded);
    const chosen = new Set([...teams.get(next.id)!.team1, ...teams.get(next.id)!.team2]);
    const onCourt = busyPlayers({ ...loaded, matches: loaded.matches.filter((m) => m.status === "playing") });
    const line = loaded.attendees
      .filter((a) => a.status === "in" && !onCourt.has(a.player_id))
      .sort((x, y) => x.queued_at - y.queued_at || x.joined_at - y.joined_at || (x.player_id < y.player_id ? -1 : 1))
      .map((a) => ({ id: a.player_id }));
    const skipped = passedOver(line, chosen);

    const now = Date.now();
    const started = "EXISTS (SELECT 1 FROM matches WHERE id = ? AND status = 'playing' AND started_at = ?)";
    const placeholders = (n: number) => Array(n).fill("?").join(", ");
    try {
      await env.DB.batch([
        env.DB.prepare("UPDATE matches SET status = 'playing', court = ?, started_at = ? WHERE id = ? AND status = 'next'").bind(
          body.court,
          now,
          next.id,
        ),
        env.DB.prepare(
          `UPDATE session_players SET skips = 0 WHERE session_id = ? AND player_id IN (${placeholders(chosen.size)}) AND ${started}`,
        ).bind(params.id, ...chosen, next.id, now),
        ...(skipped.length
          ? [
              env.DB.prepare(
                `UPDATE session_players SET skips = skips + 1 WHERE session_id = ? AND player_id IN (${placeholders(skipped.length)}) AND ${started}`,
              ).bind(params.id, ...skipped, next.id, now),
            ]
          : []),
      ]);
    } catch (err) {
      if (/UNIQUE/i.test(String(err))) throw new HttpError(409, `Court ${body.court} just got a game from another organizer.`, "court_busy");
      throw err;
    }
    return json(await freshState(env, params.id, true));
  });

  /** Replaces one player in Up Next with someone who is waiting. */
  router.post("/api/sessions/:id/next/swap", async ({ env, req, params }) => {
    const { team } = await requireOrganizer(env, req);
    const body = await readJson(req, swapSchema);
    const loaded = await loadOwnSession(env, params.id, team.id);
    assertLive(loaded);
    const next = loaded.matches.find((m) => m.status === "next");
    if (!next) throw new HttpError(409, "There's no Up Next game to change.", "no_next");
    const t = teamsOf(loaded).get(next.id)!;
    if (![...t.team1, ...t.team2].includes(body.out)) throw new HttpError(400, "That player isn't in Up Next.", "bad_swap");
    const incoming = loaded.attendees.find((a) => a.player_id === body.in);
    if (!incoming || incoming.status !== "in" || busyPlayers(loaded).has(body.in)) {
      throw new HttpError(400, "Pick someone who is waiting in line.", "bad_swap");
    }
    await env.DB.prepare("UPDATE match_players SET player_id = ? WHERE match_id = ? AND player_id = ?")
      .bind(body.in, next.id, body.out)
      .run();
    return json(await freshState(env, params.id, true));
  });

  /** Picks a different Up Next game from the same part of the line. */
  router.post("/api/sessions/:id/next/shuffle", async ({ env, req, params }) => {
    const { team } = await requireOrganizer(env, req);
    const loaded = await loadOwnSession(env, params.id, team.id);
    assertLive(loaded);
    const next = loaded.matches.find((m) => m.status === "next");
    if (!next) return json(await freshState(env, params.id, true));
    const t = teamsOf(loaded).get(next.id)!;
    await env.DB.batch(deleteNextStatements(env, next.id));
    return json(await freshState(env, params.id, true, matchKey(t.team1, t.team2)));
  });

  router.post("/api/sessions/:id/matches/:matchId/result", async ({ env, req, params }) => {
    const { team } = await requireOrganizer(env, req);
    const body = await readJson(req, resultSchema);
    const loaded = await loadOwnSession(env, params.id, team.id);
    const match = loaded.matches.find((m) => m.id === params.matchId);
    if (!match) throw new HttpError(404, "That game isn't in this session.", "not_found");
    if (match.status !== "playing") throw new HttpError(409, "This game's result is already saved.", "not_playing");

    const now = Date.now();
    await env.DB.batch([
      // Remember each player's place in line, for Undo.
      env.DB.prepare(
        `UPDATE match_players SET prev_queued_at =
           (SELECT sp.queued_at FROM session_players sp WHERE sp.session_id = ? AND sp.player_id = match_players.player_id)
         WHERE match_id = ? AND EXISTS (SELECT 1 FROM matches WHERE id = ? AND status = 'playing')`,
      ).bind(params.id, match.id, match.id),
      env.DB.prepare(
        "UPDATE matches SET status = 'done', winner = ?, score1 = ?, score2 = ?, ended_at = ? WHERE id = ? AND status = 'playing'",
      ).bind(body.winner, body.score1 ?? null, body.score2 ?? null, now, match.id),
      // All 4 go to the back of the line. The guard makes a double tap harmless.
      env.DB.prepare(
        `UPDATE session_players SET queued_at = ?
         WHERE session_id = ? AND player_id IN (SELECT player_id FROM match_players WHERE match_id = ?)
           AND EXISTS (SELECT 1 FROM matches WHERE id = ? AND status = 'done' AND ended_at = ?)`,
      ).bind(now, params.id, match.id, match.id, now),
    ]);
    return json(await freshState(env, params.id, true));
  });

  /** Puts the latest finished game back on court, e.g. after tapping the wrong team. */
  router.post("/api/sessions/:id/matches/:matchId/undo", async ({ env, req, params }) => {
    const { team } = await requireOrganizer(env, req);
    const loaded = await loadOwnSession(env, params.id, team.id);
    assertLive(loaded);
    const match = loaded.matches.find((m) => m.id === params.matchId);
    if (!match || match.status !== "done") throw new HttpError(404, "That finished game isn't in this session.", "not_found");
    const latest = loaded.matches
      .filter((m) => m.status === "done")
      .reduce((a, b) => ((b.ended_at ?? 0) > (a.ended_at ?? 0) ? b : a));
    if (latest.id !== match.id) throw new HttpError(409, "Only the latest result can be undone.", "not_latest");
    if (Date.now() - (match.ended_at ?? 0) > UNDO_MINUTES * 60000) {
      throw new HttpError(409, `Results can be undone for ${UNDO_MINUTES} minutes.`, "too_late");
    }
    if (loaded.matches.some((m) => m.status === "playing" && m.court === match.court)) {
      throw new HttpError(409, `Court ${match.court} already started another game.`, "court_busy");
    }
    const teams = teamsOf(loaded);
    const players = [...teams.get(match.id)!.team1, ...teams.get(match.id)!.team2];
    const playingNow = busyPlayers({ ...loaded, matches: loaded.matches.filter((m) => m.status === "playing") });
    if (players.some((p) => playingNow.has(p))) {
      throw new HttpError(409, "Someone from that game is already playing again.", "player_busy");
    }
    const next = loaded.matches.find((m) => m.status === "next");
    const nextHasThem = next && [...teams.get(next.id)!.team1, ...teams.get(next.id)!.team2].some((p) => players.includes(p));

    await env.DB.batch([
      ...(nextHasThem ? deleteNextStatements(env, next!.id) : []),
      env.DB.prepare(
        `UPDATE session_players SET status = 'in', queued_at = COALESCE(
           (SELECT mp.prev_queued_at FROM match_players mp WHERE mp.match_id = ? AND mp.player_id = session_players.player_id),
           queued_at)
         WHERE session_id = ? AND player_id IN (SELECT player_id FROM match_players WHERE match_id = ?)
           AND EXISTS (SELECT 1 FROM matches WHERE id = ? AND status = 'done')`,
      ).bind(match.id, params.id, match.id, match.id),
      env.DB.prepare(
        "UPDATE matches SET status = 'playing', winner = NULL, score1 = NULL, score2 = NULL, ended_at = NULL WHERE id = ? AND status = 'done'",
      ).bind(match.id),
    ]);
    return json(await freshState(env, params.id, true));
  });

  /** Takes a game off court without a result. The 4 players keep their place in line. */
  router.post("/api/sessions/:id/matches/:matchId/cancel", async ({ env, req, params }) => {
    const { team } = await requireOrganizer(env, req);
    const loaded = await loadOwnSession(env, params.id, team.id);
    const match = loaded.matches.find((m) => m.id === params.matchId);
    if (!match || match.status !== "playing") throw new HttpError(404, "That game isn't on court.", "not_found");
    await env.DB.prepare("UPDATE matches SET status = 'cancelled', ended_at = ? WHERE id = ? AND status = 'playing'")
      .bind(Date.now(), match.id)
      .run();
    return json(await freshState(env, params.id, true));
  });
}
