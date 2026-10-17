// Organizer routes for running a session: courts, Up Next, results.
import type { SessionSummary } from "../../shared/types";
import { checkIn, createGuest, recordResult, removeRsvp, setStatus } from "../actions";
import { findOrCreatePlace, ownPlaceId } from "./places";
import { requireOrganizer } from "../auth";
import { HttpError, json, readJson } from "../http";
import { randomToken, ulid } from "../ids";
import { matchKey, passedOver } from "../queue";
import type { Router } from "../router";
import {
  type Loaded,
  UNDO_MINUTES,
  assertLive,
  busyPlayers,
  deleteNextStatements,
  freshState,
  loadOwnSession,
  sentVersion,
  teamsOf,
  unchanged,
} from "../state";
import {
  bulkCheckinSchema,
  checkinSchema,
  courtSwapSchema,
  createSessionSchema,
  resultSchema,
  startSchema,
  statusSchema,
  swapSchema,
  umpireSchema,
  updateSessionSchema,
} from "../validate";

const MAX_ATTENDEES = 80;

/** The line a game is picked from when it starts: checked in and not on court (ignoring `freeCourtOf`), in line order. */
function startLine(loaded: Loaded, freeCourtOf?: string): { id: string }[] {
  const onCourt = busyPlayers({ ...loaded, matches: loaded.matches.filter((m) => m.status === "playing" && m.id !== freeCourtOf) });
  return loaded.attendees
    .filter((a) => a.status === "in" && !onCourt.has(a.player_id))
    .sort((x, y) => x.queued_at - y.queued_at || x.joined_at - y.joined_at || (x.player_id < y.player_id ? -1 : 1))
    .map((a) => ({ id: a.player_id }));
}

interface SummaryRow {
  id: string;
  title: string;
  place_id: string | null;
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
  placeId: r.place_id,
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
      `SELECT s.id, s.title, s.place_id, p.name AS venue, s.court_count, s.status, s.created_at, s.ended_at,
         (SELECT COUNT(*) FROM session_players sp WHERE sp.session_id = s.id) AS player_count,
         (SELECT COUNT(*) FROM matches m WHERE m.session_id = s.id AND m.status = 'done') AS game_count
       FROM sessions s LEFT JOIN places p ON p.id = s.place_id
       WHERE s.team_id = ? ORDER BY s.created_at DESC LIMIT 50`,
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
    const placeId = body.newPlace
      ? await findOrCreatePlace(env, team.id, body.newPlace, body.courtCount)
      : body.placeId
        ? await ownPlaceId(env, team.id, body.placeId)
        : null;
    const id = ulid();
    await env.DB.prepare(
      `INSERT INTO sessions (id, team_id, title, place_id, court_count, mode, live_token, checkin_token, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(id, team.id, body.title, placeId, body.courtCount, body.mode ?? "balanced", randomToken(9), randomToken(12), Date.now())
      .run();
    return json(await freshState(env, id, true), 201);
  });

  router.get("/api/sessions/:id", async ({ env, req, params, url }) => {
    const { team } = await requireOrganizer(env, req);
    const v = sentVersion(url);
    const row = await env.DB.prepare("SELECT team_id, version FROM sessions WHERE id = ?")
      .bind(params.id)
      .first<{ team_id: string; version: number }>();
    if (!row || row.team_id !== team.id) throw new HttpError(404, "This session doesn't exist.", "not_found");
    // Polls: one row read when nothing changed, instead of the whole session.
    if (v !== null && v === row.version) return json(unchanged(row.version));
    return json(await freshState(env, params.id, true));
  });

  router.patch("/api/sessions/:id", async ({ env, req, params }) => {
    const { team } = await requireOrganizer(env, req);
    const body = await readJson(req, updateSessionSchema);
    const loaded = await loadOwnSession(env, params.id, team.id);
    const { session } = loaded;
    const modeChanged = body.mode !== undefined && body.mode !== session.mode;
    const next = loaded.matches.find((m) => m.status === "next");
    await env.DB.batch([
      env.DB.prepare("UPDATE sessions SET title = ?, court_count = ?, self_checkin = ?, mode = ?, version = version + 1 WHERE id = ?").bind(
        body.title ?? session.title,
        body.courtCount ?? session.court_count,
        body.selfCheckin === undefined ? session.self_checkin : body.selfCheckin ? 1 : 0,
        body.mode ?? session.mode,
        session.id,
      ),
      // A new mode rebuilds Up Next with the new rules.
      ...(modeChanged && next ? deleteNextStatements(env, next.id) : []),
    ]);
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
      env.DB.prepare("UPDATE sessions SET status = 'ended', ended_at = ?, version = version + 1 WHERE id = ? AND status = 'live'").bind(now, params.id),
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

  /** Takes someone off the Coming list (they said they're coming but won't make it). */
  router.delete("/api/sessions/:id/rsvps/:playerId", async ({ env, req, params }) => {
    const { team } = await requireOrganizer(env, req);
    await loadOwnSession(env, params.id, team.id);
    await removeRsvp(env, params.id, params.playerId);
    return json(await freshState(env, params.id, true));
  });

  /** Checks in many players at once. Their order in line is shuffled so the alphabet doesn't decide who plays first. */
  router.post("/api/sessions/:id/checkin/bulk", async ({ env, req, params }) => {
    const { team } = await requireOrganizer(env, req);
    const body = await readJson(req, bulkCheckinSchema);
    const loaded = await loadOwnSession(env, params.id, team.id);
    assertLive(loaded);

    const wanted = [...new Set(body.playerIds)];
    const placeholders = wanted.map(() => "?").join(", ");
    const { results } = await env.DB.prepare(
      `SELECT id FROM players WHERE team_id = ? AND archived_at IS NULL AND id IN (${placeholders})`,
    )
      .bind(team.id, ...wanted)
      .all<{ id: string }>();
    const valid = new Set(results.map((r) => r.id));
    const already = new Set(loaded.attendees.filter((a) => a.status === "in").map((a) => a.player_id));
    const ids = wanted.filter((id) => valid.has(id) && !already.has(id));
    const newcomers = ids.filter((id) => !loaded.attendees.some((a) => a.player_id === id)).length;
    if (loaded.attendees.length + newcomers > MAX_ATTENDEES) {
      throw new HttpError(400, `A session can have up to ${MAX_ATTENDEES} players.`, "too_many");
    }

    // Fisher-Yates shuffle with a secure random source.
    const random = crypto.getRandomValues(new Uint32Array(ids.length));
    for (let i = ids.length - 1; i > 0; i--) {
      const j = random[i] % (i + 1);
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    const now = Date.now();
    const insert = env.DB.prepare(
      `INSERT INTO session_players (session_id, player_id, status, queued_at, skips, joined_at)
       VALUES (?, ?, 'in', ?, 0, ?)
       ON CONFLICT (session_id, player_id) DO UPDATE SET status = 'in', queued_at = excluded.queued_at, skips = 0`,
    );
    const clearRsvp = env.DB.prepare("DELETE FROM session_rsvps WHERE session_id = ? AND player_id = ?");
    if (ids.length) {
      await env.DB.batch(ids.flatMap((id, i) => [insert.bind(params.id, id, now + i, now + i), clearRsvp.bind(params.id, id)]));
    }
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

    const teams = teamsOf(loaded);
    const chosen = new Set([...teams.get(next.id)!.team1, ...teams.get(next.id)!.team2]);
    const skipped = passedOver(startLine(loaded), chosen);

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

  /** Replaces one player in a game on court with someone waiting. The player who comes off keeps their place in line. */
  router.post("/api/sessions/:id/matches/:matchId/swap", async ({ env, req, params }) => {
    const { team } = await requireOrganizer(env, req);
    const body = await readJson(req, courtSwapSchema);
    const loaded = await loadOwnSession(env, params.id, team.id);
    assertLive(loaded);
    const match = loaded.matches.find((m) => m.id === params.matchId);
    if (!match || match.status !== "playing") throw new HttpError(404, "That game isn't on court anymore.", "not_found");
    const t = teamsOf(loaded).get(match.id)!;
    if (![...t.team1, ...t.team2].includes(body.out)) throw new HttpError(400, "That player isn't in this game.", "bad_swap");
    const incoming = loaded.attendees.find((a) => a.player_id === body.in);
    if (!incoming || incoming.status !== "in" || busyPlayers(loaded).has(body.in)) {
      throw new HttpError(400, "Pick someone who is waiting in line.", "bad_swap");
    }
    // Each step only runs if the swap itself went through, so a double tap is harmless.
    const swapped = "EXISTS (SELECT 1 FROM match_players WHERE match_id = ? AND player_id = ?)";
    await env.DB.batch([
      env.DB.prepare(
        "UPDATE match_players SET player_id = ? WHERE match_id = ? AND player_id = ? AND EXISTS (SELECT 1 FROM matches WHERE id = ? AND status = 'playing')",
      ).bind(body.in, match.id, body.out, match.id),
      env.DB.prepare(`UPDATE session_players SET skips = 0 WHERE session_id = ? AND player_id = ? AND ${swapped}`).bind(
        params.id,
        body.in,
        match.id,
        body.in,
      ),
      ...(body.outOnBreak
        ? [
            env.DB.prepare(
              `UPDATE session_players SET status = 'break' WHERE session_id = ? AND player_id = ? AND NOT ${swapped} AND ${swapped}`,
            ).bind(params.id, body.out, match.id, body.out, match.id, body.in),
          ]
        : []),
    ]);
    return json(await freshState(env, params.id, true));
  });

  /** Moves a game on court back to Up Next, e.g. started on the wrong court or before everyone was there. */
  router.post("/api/sessions/:id/matches/:matchId/unstart", async ({ env, req, params }) => {
    const { team } = await requireOrganizer(env, req);
    const loaded = await loadOwnSession(env, params.id, team.id);
    assertLive(loaded);
    const match = loaded.matches.find((m) => m.id === params.matchId);
    if (!match || match.status !== "playing") throw new HttpError(404, "That game isn't on court anymore.", "not_found");
    const t = teamsOf(loaded).get(match.id)!;
    // Take back the skips Start handed out, using the same line Start saw (minus this court, as it was then).
    const skipped = passedOver(startLine(loaded, match.id), new Set([...t.team1, ...t.team2]));
    const next = loaded.matches.find((m) => m.status === "next");
    const playing = "EXISTS (SELECT 1 FROM matches WHERE id = ? AND status = 'playing')";
    await env.DB.batch([
      ...(skipped.length
        ? [
            env.DB.prepare(
              `UPDATE session_players SET skips = MAX(skips - 1, 0)
               WHERE session_id = ? AND player_id IN (${skipped.map(() => "?").join(", ")}) AND ${playing}`,
            ).bind(params.id, ...skipped, match.id),
          ]
        : []),
      // Any umpire scoring starts over when the game starts again.
      env.DB.prepare(`DELETE FROM rallies WHERE match_id = ? AND ${playing}`).bind(match.id, match.id),
      // Only one Up Next is allowed, so the one that formed after Start goes first.
      ...(next ? deleteNextStatements(env, next.id) : []),
      env.DB.prepare(
        `UPDATE matches SET status = 'next', court = NULL, started_at = NULL, first_server = NULL, umpire_id = NULL
         WHERE id = ? AND status = 'playing'`,
      ).bind(match.id),
    ]);
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
    await recordResult(env, params.id, match.id, body.winner, body.score1 ?? null, body.score2 ?? null);
    return json(await freshState(env, params.id, true));
  });

  /** Fixes the winner or score of any finished game, even after the session ends. The line and courts stay as they are. */
  router.patch("/api/sessions/:id/matches/:matchId/result", async ({ env, req, params }) => {
    const { team } = await requireOrganizer(env, req);
    const body = await readJson(req, resultSchema);
    const loaded = await loadOwnSession(env, params.id, team.id);
    const match = loaded.matches.find((m) => m.id === params.matchId);
    if (!match || match.status !== "done") throw new HttpError(404, "That finished game isn't in this session.", "not_found");
    await env.DB.prepare("UPDATE matches SET winner = ?, score1 = ?, score2 = ? WHERE id = ? AND status = 'done'")
      .bind(body.winner, body.score1 ?? null, body.score2 ?? null, match.id)
      .run();
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
      throw new HttpError(
        409,
        `This game ended over ${UNDO_MINUTES} minutes ago, so it can't go back on court. Tap Edit on the game to fix the winner or score.`,
        "too_late",
      );
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
    await env.DB.batch([
      env.DB.prepare("DELETE FROM rallies WHERE match_id = ? AND EXISTS (SELECT 1 FROM matches WHERE id = ? AND status = 'playing')").bind(
        match.id,
        match.id,
      ),
      env.DB.prepare("UPDATE matches SET status = 'cancelled', ended_at = ? WHERE id = ? AND status = 'playing'").bind(Date.now(), match.id),
    ]);
    return json(await freshState(env, params.id, true));
  });

  /** Makes someone an umpire for this session: a roster player (often someone done playing) or a new guest. */
  router.post("/api/sessions/:id/umpires", async ({ env, req, params }) => {
    const { team } = await requireOrganizer(env, req);
    const body = await readJson(req, umpireSchema);
    const loaded = await loadOwnSession(env, params.id, team.id);
    assertLive(loaded);
    const playerId = body.playerId ?? (await createGuest(env, team.id, body.name!, null));
    const player = await env.DB.prepare("SELECT 1 FROM players WHERE id = ? AND team_id = ? AND archived_at IS NULL")
      .bind(playerId, team.id)
      .first();
    if (!player) throw new HttpError(404, "That player isn't on the roster.", "not_found");
    // Done playing? Take them out of the line first (refused if they're on court right now).
    const attendee = loaded.attendees.find((a) => a.player_id === playerId);
    if (body.onBreak && attendee?.status === "in") await setStatus(env, loaded, playerId, "break");
    if (!loaded.umpires.some((u) => u.player_id === playerId)) {
      await env.DB.prepare("INSERT OR IGNORE INTO umpires (id, session_id, player_id, token, created_at) VALUES (?, ?, ?, ?, ?)")
        .bind(ulid(), params.id, playerId, randomToken(12), Date.now())
        .run();
    }
    return json(await freshState(env, params.id, true));
  });

  /** Turns an umpire link off. A game they were scoring keeps its score and can be taken over. */
  router.delete("/api/sessions/:id/umpires/:umpireId", async ({ env, req, params }) => {
    const { team } = await requireOrganizer(env, req);
    await loadOwnSession(env, params.id, team.id);
    await env.DB.batch([
      env.DB.prepare("UPDATE umpires SET revoked_at = ? WHERE id = ? AND session_id = ? AND revoked_at IS NULL").bind(
        Date.now(),
        params.umpireId,
        params.id,
      ),
      env.DB.prepare("UPDATE matches SET umpire_id = NULL WHERE umpire_id = ? AND session_id = ?").bind(params.umpireId, params.id),
    ]);
    return json(await freshState(env, params.id, true));
  });
}
