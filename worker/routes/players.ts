// The team roster.
import type { RosterPlayer } from "../../shared/types";
import { requireOrganizer } from "../auth";
import type { Env } from "../env";
import { HttpError, json, readJson } from "../http";
import { ulid } from "../ids";
import type { Router } from "../router";
import { bulkPlayersSchema, playerSchema, updatePlayerSchema } from "../validate";

export const MAX_PLAYERS = 300;

interface RosterRow {
  id: string;
  name: string;
  skill: number | null;
  is_guest: number;
  created_at: number;
  sessions: number;
  games: number;
}

const toRoster = (r: RosterRow): RosterPlayer => ({
  id: r.id,
  name: r.name,
  skill: r.skill,
  isGuest: r.is_guest === 1,
  createdAt: r.created_at,
  sessions: r.sessions,
  games: r.games,
});

const ROSTER_SQL = `
  SELECT p.id, p.name, p.skill, p.is_guest, p.created_at,
    (SELECT COUNT(*) FROM session_players sp WHERE sp.player_id = p.id) AS sessions,
    (SELECT COUNT(*) FROM match_players mp JOIN matches m ON m.id = mp.match_id
      WHERE mp.player_id = p.id AND m.status = 'done') AS games
  FROM players p`;

export async function activePlayerCount(env: Env, teamId: string): Promise<number> {
  const row = await env.DB.prepare("SELECT COUNT(*) AS n FROM players WHERE team_id = ? AND archived_at IS NULL")
    .bind(teamId)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

export function playerRoutes(router: Router): void {
  router.get("/api/players", async ({ env, req }) => {
    const { team } = await requireOrganizer(env, req);
    const { results } = await env.DB.prepare(`${ROSTER_SQL} WHERE p.team_id = ? AND p.archived_at IS NULL ORDER BY p.name COLLATE NOCASE`)
      .bind(team.id)
      .all<RosterRow>();
    return json(results.map(toRoster));
  });

  router.post("/api/players", async ({ env, req }) => {
    const { team } = await requireOrganizer(env, req);
    const body = await readJson(req, playerSchema);
    if ((await activePlayerCount(env, team.id)) >= MAX_PLAYERS) {
      throw new HttpError(400, `A team can have up to ${MAX_PLAYERS} players. Remove old guests first.`, "too_many");
    }
    const dupe = await env.DB.prepare("SELECT 1 FROM players WHERE team_id = ? AND archived_at IS NULL AND name = ? COLLATE NOCASE")
      .bind(team.id, body.name)
      .first();
    if (dupe) throw new HttpError(409, `${body.name} is already on the roster. Add a last initial to tell them apart.`, "duplicate");
    const id = ulid();
    const now = Date.now();
    await env.DB.prepare("INSERT INTO players (id, team_id, name, skill, is_guest, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(id, team.id, body.name, body.skill ?? null, body.isGuest ? 1 : 0, now)
      .run();
    return json(toRoster({ id, name: body.name, skill: body.skill ?? null, is_guest: body.isGuest ? 1 : 0, created_at: now, sessions: 0, games: 0 }), 201);
  });

  /** Paste a list of names (one per line, e.g. from the group chat). Skips names already on the roster. */
  router.post("/api/players/bulk", async ({ env, req }) => {
    const { team } = await requireOrganizer(env, req);
    const body = await readJson(req, bulkPlayersSchema);
    const { results } = await env.DB.prepare("SELECT name FROM players WHERE team_id = ? AND archived_at IS NULL")
      .bind(team.id)
      .all<{ name: string }>();
    const seen = new Set(results.map((r) => r.name.toLowerCase()));
    const fresh: string[] = [];
    for (const name of body.names) {
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      fresh.push(name);
    }
    if (results.length + fresh.length > MAX_PLAYERS) {
      throw new HttpError(400, `A team can have up to ${MAX_PLAYERS} players.`, "too_many");
    }
    const now = Date.now();
    if (fresh.length) {
      const insert = env.DB.prepare("INSERT INTO players (id, team_id, name, created_at) VALUES (?, ?, ?, ?)");
      await env.DB.batch(fresh.map((name, i) => insert.bind(ulid(now + i), team.id, name, now)));
    }
    return json({ added: fresh.length, skipped: body.names.length - fresh.length }, 201);
  });

  router.patch("/api/players/:id", async ({ env, req, params }) => {
    const { team } = await requireOrganizer(env, req);
    const body = await readJson(req, updatePlayerSchema);
    const current = await env.DB.prepare("SELECT * FROM players WHERE id = ? AND team_id = ? AND archived_at IS NULL")
      .bind(params.id, team.id)
      .first<{ name: string; skill: number | null; is_guest: number }>();
    if (!current) throw new HttpError(404, "That player isn't on your roster.", "not_found");
    const name = body.name ?? current.name;
    if (body.name && body.name.toLowerCase() !== current.name.toLowerCase()) {
      const dupe = await env.DB.prepare(
        "SELECT 1 FROM players WHERE team_id = ? AND archived_at IS NULL AND name = ? COLLATE NOCASE AND id != ?",
      )
        .bind(team.id, body.name, params.id)
        .first();
      if (dupe) throw new HttpError(409, `${body.name} is already on the roster.`, "duplicate");
    }
    await env.DB.prepare("UPDATE players SET name = ?, skill = ?, is_guest = ? WHERE id = ?")
      .bind(
        name,
        body.skill === undefined ? current.skill : body.skill,
        body.isGuest === undefined ? current.is_guest : body.isGuest ? 1 : 0,
        params.id,
      )
      .run();
    const row = await env.DB.prepare(`${ROSTER_SQL} WHERE p.id = ?`).bind(params.id).first<RosterRow>();
    return json(toRoster(row!));
  });

  /** Removes a player from the roster. Their old games stay in history. */
  router.delete("/api/players/:id", async ({ env, req, params }) => {
    const { team } = await requireOrganizer(env, req);
    const playing = await env.DB.prepare(
      `SELECT 1 FROM session_players sp JOIN sessions s ON s.id = sp.session_id
       WHERE sp.player_id = ? AND s.status = 'live' AND sp.status != 'left'`,
    )
      .bind(params.id)
      .first();
    if (playing) throw new HttpError(409, "This player is checked in right now. Check them out first.", "checked_in");
    const res = await env.DB.prepare("UPDATE players SET archived_at = ? WHERE id = ? AND team_id = ? AND archived_at IS NULL")
      .bind(Date.now(), params.id, team.id)
      .run();
    if (!res.meta.changes) throw new HttpError(404, "That player isn't on your roster.", "not_found");
    return json({ ok: true });
  });
}
