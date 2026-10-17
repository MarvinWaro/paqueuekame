import type { Place } from "../../shared/types";
import { requireOrganizer } from "../auth";
import type { Env } from "../env";
import { HttpError, json, readJson } from "../http";
import { ulid } from "../ids";
import type { Router } from "../router";
import { placeSchema, updatePlaceSchema } from "../validate";

interface PlaceRow {
  id: string;
  name: string;
  court_count: number;
  sessions: number;
  last_played_at: number | null;
}

const toPlace = (r: PlaceRow): Place => ({
  id: r.id,
  name: r.name,
  courtCount: r.court_count,
  sessions: r.sessions,
  lastPlayedAt: r.last_played_at,
});

const PLACES_SQL = `
  SELECT p.id, p.name, p.court_count, COUNT(s.id) AS sessions, MAX(s.created_at) AS last_played_at
  FROM places p LEFT JOIN sessions s ON s.place_id = p.id
  WHERE p.team_id = ? AND p.archived_at IS NULL`;

async function loadPlace(env: Env, teamId: string, id: string): Promise<Place> {
  const row = await env.DB.prepare(`${PLACES_SQL} AND p.id = ? GROUP BY p.id`).bind(teamId, id).first<PlaceRow>();
  if (!row) throw new HttpError(404, "That place isn't in your list.", "not_found");
  return toPlace(row);
}

/** The place's id if it belongs to the team. */
export async function ownPlaceId(env: Env, teamId: string, id: string): Promise<string> {
  const row = await env.DB.prepare("SELECT id FROM places WHERE id = ? AND team_id = ?").bind(id, teamId).first<{ id: string }>();
  if (!row) throw new HttpError(400, "Pick one of your places.", "bad_place");
  return row.id;
}

/** Reuses the team's place with this name (ignoring case), bringing it back if it was removed; otherwise adds it. */
export async function findOrCreatePlace(env: Env, teamId: string, name: string, courtCount: number): Promise<string> {
  const existing = await env.DB.prepare("SELECT id FROM places WHERE team_id = ? AND name = ? COLLATE NOCASE")
    .bind(teamId, name)
    .first<{ id: string }>();
  if (existing) {
    await env.DB.prepare("UPDATE places SET archived_at = NULL WHERE id = ?").bind(existing.id).run();
    return existing.id;
  }
  const id = ulid();
  await env.DB.prepare("INSERT INTO places (id, team_id, name, court_count, created_at) VALUES (?, ?, ?, ?, ?)")
    .bind(id, teamId, name, courtCount, Date.now())
    .run();
  return id;
}

export function placeRoutes(router: Router): void {
  router.get("/api/places", async ({ env, req }) => {
    const { team } = await requireOrganizer(env, req);
    const { results } = await env.DB.prepare(`${PLACES_SQL} GROUP BY p.id ORDER BY last_played_at DESC NULLS LAST, p.name`)
      .bind(team.id)
      .all<PlaceRow>();
    return json(results.map(toPlace));
  });

  router.post("/api/places", async ({ env, req }) => {
    const { team } = await requireOrganizer(env, req);
    const body = await readJson(req, placeSchema);
    const taken = await env.DB.prepare("SELECT archived_at FROM places WHERE team_id = ? AND name = ? COLLATE NOCASE")
      .bind(team.id, body.name)
      .first<{ archived_at: number | null }>();
    if (taken && taken.archived_at === null) throw new HttpError(409, `You already have a place called ${body.name}.`, "place_taken");
    const id = await findOrCreatePlace(env, team.id, body.name, body.courtCount);
    await env.DB.prepare("UPDATE places SET court_count = ? WHERE id = ?").bind(body.courtCount, id).run();
    return json(await loadPlace(env, team.id, id), 201);
  });

  router.patch("/api/places/:id", async ({ env, req, params }) => {
    const { team } = await requireOrganizer(env, req);
    const body = await readJson(req, updatePlaceSchema);
    const place = await env.DB.prepare("SELECT name, court_count FROM places WHERE id = ? AND team_id = ? AND archived_at IS NULL")
      .bind(params.id, team.id)
      .first<{ name: string; court_count: number }>();
    if (!place) throw new HttpError(404, "That place isn't in your list.", "not_found");
    if (body.name && body.name.toLowerCase() !== place.name.toLowerCase()) {
      const taken = await env.DB.prepare("SELECT 1 FROM places WHERE team_id = ? AND name = ? COLLATE NOCASE AND id != ?")
        .bind(team.id, body.name, params.id)
        .first();
      if (taken) throw new HttpError(409, `You already have a place called ${body.name}.`, "place_taken");
    }
    await env.DB.prepare("UPDATE places SET name = ?, court_count = ?, archived_at = ? WHERE id = ? AND team_id = ?")
      .bind(body.name ?? place.name, body.courtCount ?? place.court_count, body.archived ? Date.now() : null, params.id, team.id)
      .run();
    if (body.archived) return json({ ok: true });
    return json(await loadPlace(env, team.id, params.id));
  });
}
