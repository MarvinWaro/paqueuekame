// API shapes shared by the Worker and the React app.

export interface ApiErrorBody {
  error: string;
  code?: string;
}

export interface Team {
  id: string;
  slug: string;
  name: string;
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
  venue: string | null;
  courtCount: number;
  status: SessionStatus;
  createdAt: number;
  endedAt: number | null;
  playerCount: number;
  gameCount: number;
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
}

export interface SessionState {
  teamName: string;
  session: SessionSummary & { selfCheckin: boolean; liveToken: string };
  courts: CourtView[];
  next: MatchView | null;
  queue: QueueEntry[];
  attendance: Attendance[];
  results: MatchView[]; // finished games, newest first
  standings: Standing[];
  avgGameMinutes: number;
  serverTime: number;
  /** Organizer only: the token printed inside the court QR code. */
  checkinToken?: string;
}

export interface CheckinRoster {
  teamName: string;
  sessionTitle: string;
  players: Player[];
}
