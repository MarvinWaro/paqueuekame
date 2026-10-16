// Loads a session from D1, turns it into the API's SessionState, and keeps Up Next filled.
import type {
  Attendance,
  AttendanceStatus,
  CourtView,
  MatchStatus,
  MatchView,
  Player,
  QueueEntry,
  SessionState,
  Standing,
} from "../shared/types";
import type { Env } from "./env";
import { HttpError } from "./http";
import { ulid } from "./ids";
import { type History, type Waiting, addGame, emptyHistory, pickMatch } from "./queue";

const DEFAULT_GAME_MINUTES = 12;

export interface SessionRow {
  id: string;
  team_id: string;
  team_name: string;
  title: string;
  venue: string | null;
  court_count: number;
  status: "live" | "ended";
  live_token: string;
  checkin_token: string;
  self_checkin: number;
  created_at: number;
  ended_at: number | null;
}

interface AttendeeRow {
  player_id: string;
  name: string;
  skill: number | null;
  is_guest: number;
  status: AttendanceStatus;
  queued_at: number;
  skips: number;
  joined_at: number;
}

interface MatchRow {
  id: string;
  status: MatchStatus;
  court: number | null;
  winner: 1 | 2 | null;
  score1: number | null;
  score2: number | null;
  created_at: number;
  started_at: number | null;
  ended_at: number | null;
}

interface MatchPlayerRow {
  match_id: string;
  player_id: string;
  team: 1 | 2;
  prev_queued_at: number | null;
}

export interface Loaded {
  session: SessionRow;
  attendees: AttendeeRow[];
  matches: MatchRow[];
  matchPlayers: MatchPlayerRow[];
}

export async function loadSession(env: Env, sessionId: string): Promise<Loaded> {
  const [s, a, m, mp] = await env.DB.batch([
    env.DB.prepare(
      `SELECT s.*, t.name AS team_name FROM sessions s JOIN teams t ON t.id = s.team_id WHERE s.id = ?`,
    ).bind(sessionId),
    env.DB.prepare(
      `SELECT sp.player_id, p.name, p.skill, p.is_guest, sp.status, sp.queued_at, sp.skips, sp.joined_at
       FROM session_players sp JOIN players p ON p.id = sp.player_id
       WHERE sp.session_id = ?`,
    ).bind(sessionId),
    env.DB.prepare(
      `SELECT id, status, court, winner, score1, score2, created_at, started_at, ended_at
       FROM matches WHERE session_id = ? AND status != 'cancelled'`,
    ).bind(sessionId),
    env.DB.prepare(
      `SELECT mp.match_id, mp.player_id, mp.team, mp.prev_queued_at
       FROM match_players mp JOIN matches m ON m.id = mp.match_id
       WHERE m.session_id = ? AND m.status != 'cancelled'`,
    ).bind(sessionId),
  ]);
  const session = s.results[0] as SessionRow | undefined;
  if (!session) throw new HttpError(404, "This session doesn't exist.", "not_found");
  return {
    session,
    attendees: a.results as AttendeeRow[],
    matches: m.results as MatchRow[],
    matchPlayers: mp.results as MatchPlayerRow[],
  };
}

/** Loads a session and checks it belongs to the organizer's team. */
export async function loadOwnSession(env: Env, sessionId: string, teamId: string): Promise<Loaded> {
  const loaded = await loadSession(env, sessionId);
  if (loaded.session.team_id !== teamId) throw new HttpError(404, "This session doesn't exist.", "not_found");
  return loaded;
}

export function assertLive(loaded: Loaded): void {
  if (loaded.session.status !== "live") {
    throw new HttpError(409, "This session has ended. Start a new one to keep playing.", "session_ended");
  }
}

// ---------- Derived data ----------

export function teamsOf(loaded: Loaded): Map<string, { team1: string[]; team2: string[] }> {
  const map = new Map<string, { team1: string[]; team2: string[] }>();
  for (const mp of loaded.matchPlayers) {
    let entry = map.get(mp.match_id);
    if (!entry) map.set(mp.match_id, (entry = { team1: [], team2: [] }));
    (mp.team === 1 ? entry.team1 : entry.team2).push(mp.player_id);
  }
  return map;
}

/** Players in the Up Next match or on a court right now. */
export function busyPlayers(loaded: Loaded): Set<string> {
  const active = new Set(loaded.matches.filter((m) => m.status === "next" || m.status === "playing").map((m) => m.id));
  return new Set(loaded.matchPlayers.filter((mp) => active.has(mp.match_id)).map((mp) => mp.player_id));
}

/** Checked-in players who are waiting, in line order. */
export function waitingLine(loaded: Loaded): AttendeeRow[] {
  const busy = busyPlayers(loaded);
  return loaded.attendees
    .filter((a) => a.status === "in" && !busy.has(a.player_id))
    .sort((x, y) => x.queued_at - y.queued_at || x.joined_at - y.joined_at || (x.player_id < y.player_id ? -1 : 1));
}

function historyOf(loaded: Loaded): History {
  const teams = teamsOf(loaded);
  const history = emptyHistory();
  for (const m of loaded.matches) {
    if (m.status !== "done" && m.status !== "playing") continue;
    const t = teams.get(m.id);
    if (t) addGame(history, t.team1, t.team2);
  }
  return history;
}

// ---------- Up Next ----------

/** Statements that remove an Up Next match (players first, so it works with or without FK cascades). */
export function deleteNextStatements(env: Env, matchId: string) {
  const guard = "EXISTS (SELECT 1 FROM matches WHERE id = ? AND status = 'next')";
  return [
    env.DB.prepare(`DELETE FROM match_players WHERE match_id = ? AND ${guard}`).bind(matchId, matchId),
    env.DB.prepare("DELETE FROM matches WHERE id = ? AND status = 'next'").bind(matchId),
  ];
}

/** Creates the Up Next match when there isn't one and 4 or more players are waiting. */
export async function refillNext(env: Env, loaded: Loaded, avoid?: string): Promise<boolean> {
  if (loaded.session.status !== "live") return false;
  if (loaded.matches.some((m) => m.status === "next")) return false;
  const line: Waiting[] = waitingLine(loaded).map((a) => ({ id: a.player_id, skill: a.skill, skips: a.skips }));
  const pick = pickMatch(line, historyOf(loaded), avoid) ?? (avoid ? pickMatch(line, historyOf(loaded)) : null);
  if (!pick) return false;

  const matchId = ulid();
  const insertPlayer = env.DB.prepare("INSERT INTO match_players (match_id, player_id, team) VALUES (?, ?, ?)");
  try {
    await env.DB.batch([
      env.DB.prepare("INSERT INTO matches (id, session_id, status, created_at) VALUES (?, ?, 'next', ?)").bind(
        matchId,
        loaded.session.id,
        Date.now(),
      ),
      ...pick.team1.map((p) => insertPlayer.bind(matchId, p, 1)),
      ...pick.team2.map((p) => insertPlayer.bind(matchId, p, 2)),
    ]);
  } catch (err) {
    // Another organizer's tap created Up Next at the same moment. Theirs wins.
    if (/UNIQUE/i.test(String(err))) return false;
    throw err;
  }
  return true;
}

/** Loads the session, tops up Up Next, and returns the fresh state. */
export async function freshState(env: Env, sessionId: string, forOrganizer: boolean, avoid?: string): Promise<SessionState> {
  let loaded = await loadSession(env, sessionId);
  if (await refillNext(env, loaded, avoid)) loaded = await loadSession(env, sessionId);
  return buildState(loaded, forOrganizer);
}

// ---------- API shape ----------

export function buildState(loaded: Loaded, forOrganizer: boolean): SessionState {
  const { session } = loaded;
  const people = new Map<string, Player>(
    loaded.attendees.map((a) => [a.player_id, { id: a.player_id, name: a.name, skill: a.skill, isGuest: a.is_guest === 1 }]),
  );
  const teams = teamsOf(loaded);
  const view = (m: MatchRow): MatchView => {
    const t = teams.get(m.id) ?? { team1: [], team2: [] };
    const toPlayers = (ids: string[]) => ids.map((id) => people.get(id)).filter((p): p is Player => !!p);
    return {
      id: m.id,
      status: m.status,
      court: m.court,
      team1: toPlayers(t.team1),
      team2: toPlayers(t.team2),
      winner: m.winner,
      score1: m.score1,
      score2: m.score2,
      startedAt: m.started_at,
      endedAt: m.ended_at,
    };
  };

  const done = loaded.matches
    .filter((m) => m.status === "done")
    .sort((a, b) => (b.ended_at ?? 0) - (a.ended_at ?? 0));

  // Games, wins and point difference per player.
  const stats = new Map<string, { games: number; wins: number; diff: number }>();
  for (const m of done) {
    const t = teams.get(m.id);
    if (!t) continue;
    for (const [side, ids] of [
      [1, t.team1],
      [2, t.team2],
    ] as const) {
      for (const id of ids) {
        const s = stats.get(id) ?? { games: 0, wins: 0, diff: 0 };
        s.games++;
        if (m.winner === side) s.wins++;
        if (m.score1 != null && m.score2 != null) s.diff += side === 1 ? m.score1 - m.score2 : m.score2 - m.score1;
        stats.set(id, s);
      }
    }
  }

  const durations = done
    .slice(0, 10)
    .filter((m) => m.started_at && m.ended_at)
    .map((m) => (m.ended_at! - m.started_at!) / 60000);
  const avgGameMinutes = durations.length
    ? Math.min(30, Math.max(5, Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)))
    : DEFAULT_GAME_MINUTES;

  const playing = loaded.matches.filter((m) => m.status === "playing");
  const courtTotal = Math.max(session.court_count, ...playing.map((m) => m.court ?? 0));
  const courts: CourtView[] = [];
  for (let c = 1; c <= courtTotal; c++) {
    const m = playing.find((x) => x.court === c);
    courts.push({ court: c, match: m ? view(m) : null });
  }

  const nextRow = loaded.matches.find((m) => m.status === "next");
  const perCourt = avgGameMinutes / Math.max(1, session.court_count);
  const queue: QueueEntry[] = waitingLine(loaded).map((a, i) => ({
    player: people.get(a.player_id)!,
    position: i + 1,
    games: stats.get(a.player_id)?.games ?? 0,
    waitingSince: a.queued_at,
    estMinutes: Math.round((Math.ceil((i + 1) / 4) + (nextRow ? 1 : 0)) * perCourt),
  }));

  const attendance: Attendance[] = loaded.attendees
    .map((a) => ({ player: people.get(a.player_id)!, status: a.status, games: stats.get(a.player_id)?.games ?? 0 }))
    .sort((x, y) => x.player.name.localeCompare(y.player.name));

  const standings: Standing[] = [...stats.entries()]
    .map(([id, s]) => ({ player: people.get(id)!, games: s.games, wins: s.wins, losses: s.games - s.wins, pointDiff: s.diff }))
    .filter((s) => s.player)
    .sort(
      (a, b) =>
        b.wins - a.wins ||
        b.wins / b.games - a.wins / a.games ||
        b.pointDiff - a.pointDiff ||
        a.player.name.localeCompare(b.player.name),
    );

  return {
    teamName: session.team_name,
    session: {
      id: session.id,
      title: session.title,
      venue: session.venue,
      courtCount: session.court_count,
      status: session.status,
      createdAt: session.created_at,
      endedAt: session.ended_at,
      playerCount: loaded.attendees.length,
      gameCount: done.length,
      selfCheckin: session.self_checkin === 1,
      liveToken: session.live_token,
    },
    courts,
    next: nextRow ? view(nextRow) : null,
    queue,
    attendance,
    results: done.slice(0, 40).map(view),
    standings,
    avgGameMinutes,
    serverTime: Date.now(),
    ...(forOrganizer ? { checkinToken: session.checkin_token } : {}),
  };
}
