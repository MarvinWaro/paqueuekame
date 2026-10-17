import type { LeaderRow, Leaderboard, LeaderboardRange } from "../../shared/types";
import { requireOrganizer } from "../auth";
import { json, readQuery } from "../http";
import type { Router } from "../router";
import { leaderboardQuery } from "../validate";

/** Wall-clock parts of a UTC time in a time zone. */
function zoned(tz: string, utcMs: number): Record<string, number> {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  }).formatToParts(new Date(utcMs));
  return Object.fromEntries(parts.filter((p) => p.type !== "literal").map((p) => [p.type, Number(p.value)]));
}

/** UTC ms of midnight on the 1st of a month (0-based, may overflow) in the team's time zone. */
function monthStart(tz: string, year: number, month: number): number {
  const guess = Date.UTC(year, month, 1);
  const z = zoned(tz, guess);
  const offset = Date.UTC(z.year, z.month - 1, z.day, z.hour, z.minute, z.second) - guess;
  return guess - offset;
}

function bounds(range: LeaderboardRange, tz: string, now: number): [number, number] | null {
  if (range === "all") return null;
  const { year, month } = zoned(tz, now);
  return range === "month"
    ? [monthStart(tz, year, month - 1), monthStart(tz, year, month)]
    : [monthStart(tz, year, month - 2), monthStart(tz, year, month - 1)];
}

export function clubRoutes(router: Router): void {
  /** Totals per player across the team's sessions, by month or all time, optionally at one place. */
  router.get("/api/club/leaderboard", async ({ env, req, url }) => {
    const { team } = await requireOrganizer(env, req);
    const query = readQuery(url, leaderboardQuery);
    const range = bounds(query.range, team.timezone, Date.now());
    const place = query.place ?? null;
    const where = "s.team_id = ? AND s.created_at >= ? AND s.created_at < ? AND (? IS NULL OR s.place_id = ?)";
    const binds = [team.id, range?.[0] ?? 0, range?.[1] ?? Number.MAX_SAFE_INTEGER, place, place];

    const [games, attended, totals] = await env.DB.batch([
      env.DB.prepare(
        `SELECT mp.player_id AS id, COUNT(*) AS games, SUM(m.winner = mp.team) AS wins
         FROM sessions s
         JOIN matches m ON m.session_id = s.id AND m.status = 'done'
         JOIN match_players mp ON mp.match_id = m.id
         WHERE ${where} GROUP BY mp.player_id`,
      ).bind(...binds),
      env.DB.prepare(
        `SELECT sp.player_id AS id, p.name, p.skill, p.is_guest, COUNT(*) AS sessions
         FROM sessions s
         JOIN session_players sp ON sp.session_id = s.id
         JOIN players p ON p.id = sp.player_id
         WHERE ${where} GROUP BY sp.player_id`,
      ).bind(...binds),
      env.DB.prepare(
        `SELECT COUNT(*) AS sessions,
           (SELECT COUNT(*) FROM sessions s JOIN matches m ON m.session_id = s.id AND m.status = 'done' WHERE ${where}) AS games
         FROM sessions s WHERE ${where}`,
      ).bind(...binds, ...binds),
    ]);

    const played = new Map((games.results as { id: string; games: number; wins: number }[]).map((g) => [g.id, g]));
    const rows: LeaderRow[] = (
      attended.results as { id: string; name: string; skill: number | null; is_guest: number; sessions: number }[]
    ).map((a) => ({
      player: { id: a.id, name: a.name, skill: a.skill, isGuest: a.is_guest === 1 },
      sessions: a.sessions,
      games: played.get(a.id)?.games ?? 0,
      wins: played.get(a.id)?.wins ?? 0,
    }));
    const total = totals.results[0] as { sessions: number; games: number };
    const board: Leaderboard = {
      range: query.range,
      from: range?.[0] ?? null,
      to: range?.[1] ?? null,
      placeId: place,
      sessions: total.sessions,
      games: total.games,
      rows,
    };
    return json(board);
  });
}
