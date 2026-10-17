// API shapes shared by the Worker and the React app.
import type { CourtColors } from "./courtThemes";
import type { SideoutScore } from "./sideout";

export interface ApiErrorBody {
  error: string;
  code?: string;
}

export interface Team {
  id: string;
  slug: string;
  name: string;
  courtTheme: string; // a preset key, or "custom"
  customColors: CourtColors | null; // saved even while a preset is picked
}

export interface Organizer {
  id: string;
  name: string;
  email: string;
}

export interface Me {
  organizer: Organizer;
  team: Team;
  liveSessionId: string | null;
}

export interface Player {
  id: string;
  name: string;
  skill: number | null;
  isGuest: boolean;
}

export interface RosterPlayer extends Player {
  createdAt: number;
  sessions: number; // sessions attended
  games: number; // games played, all sessions
}

export type SessionStatus = "live" | "ended";

export interface SessionSummary {
  id: string;
  title: string;
  placeId: string | null;
  venue: string | null; // the place's name
  courtCount: number;
  status: SessionStatus;
  createdAt: number;
  endedAt: number | null;
  playerCount: number;
  gameCount: number;
}

export interface Place {
  id: string;
  name: string;
  courtCount: number; // usual courts booked there
  sessions: number;
  lastPlayedAt: number | null;
}

export type LeaderboardRange = "month" | "last-month" | "all";

/** One player's totals across the sessions in a leaderboard's range and place. */
export interface LeaderRow {
  player: Player;
  sessions: number; // sessions attended
  games: number;
  wins: number;
}

export interface Leaderboard {
  range: LeaderboardRange;
  from: number | null; // UTC ms, null for all time
  to: number | null;
  placeId: string | null;
  sessions: number;
  games: number;
  rows: LeaderRow[];
}

export type MatchStatus = "next" | "playing" | "done" | "cancelled";

export interface MatchView {
  id: string;
  status: MatchStatus;
  court: number | null;
  team1: Player[];
  team2: Player[];
  winner: 1 | 2 | null;
  score1: number | null;
  score2: number | null;
  startedAt: number | null;
  endedAt: number | null;
  live: LiveScore | null; // an umpire is scoring this game on court
}

/** The running score of a game an umpire is scoring (traditional side-out, see shared/sideout.ts). */
export interface LiveScore extends SideoutScore {
  umpireId: string | null;
  umpire: string | null; // who is scoring it
}

/** An umpire for a session. The token goes only to organizers, inside the umpire's link. */
export interface UmpireInfo {
  id: string;
  playerId: string;
  name: string;
  token: string;
}

/** What an umpire's phone shows: the courts and their games. No queue controls. */
export interface UmpireState {
  version: number;
  umpire: { id: string; name: string };
  teamName: string;
  sessionTitle: string;
  status: SessionStatus;
  courtColors: CourtColors;
  courts: CourtView[];
  serverTime: number;
}

export interface CourtView {
  court: number;
  match: MatchView | null;
}

export interface QueueEntry {
  player: Player;
  position: number; // 1 = first in line after Up Next
  games: number;
  waitingSince: number;
  estMinutes: number;
}

export type AttendanceStatus = "in" | "break" | "left";

export interface Attendance {
  player: Player;
  status: AttendanceStatus;
  games: number;
}

export interface Standing {
  player: Player;
  games: number;
  wins: number;
  losses: number;
  pointDiff: number;
  winRate: number; // 0 to 1
  /** Average win rate of the opponents they faced, 0 to 1. Breaks ties: beating strong teams counts more. */
  oppStrength: number;
}

export interface SessionStats {
  games: number;
  minutes: number; // first game start to last game end
  courts: number;
  players: number;
  avgGameSeconds: number | null;
  avgWaitSeconds: number | null; // time in line before each game
  timedGames: number;
}

export interface SessionState {
  /** Goes up on every change. Polls send it back to get a tiny "unchanged" reply. */
  version: number;
  teamName: string;
  courtColors: CourtColors;
  session: SessionSummary & { selfCheckin: boolean; liveToken: string; mode: string };
  courts: CourtView[];
  next: MatchView | null;
  queue: QueueEntry[];
  attendance: Attendance[];
  coming: Player[]; // tapped "I'm coming" from the group-chat link; not in line yet
  results: MatchView[]; // finished games, newest first
  undoUntil: number | null; // results[0] can go back on court until then (server time)
  standings: Standing[];
  avgGameMinutes: number;
  stats: SessionStats;
  serverTime: number;
  /** Organizer only: the token printed inside the court QR code. */
  checkinToken?: string;
  /** Organizer only: umpires and their link tokens. */
  umpires?: UmpireInfo[];
}

/** Reply to a poll when nothing changed since `version`. */
export interface Unchanged {
  unchanged: true;
  version: number;
  serverTime: number;
}

export interface CheckinRoster {
  teamName: string;
  sessionTitle: string;
  players: Player[];
}
