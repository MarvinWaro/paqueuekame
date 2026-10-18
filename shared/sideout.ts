// Traditional side-out scoring for doubles, worked out from the umpire's event log.
// Used by the Worker (the real score) and the umpire's phone (instant feedback).
//
// Rules:
// - Only the serving team scores. The game starts at 0-0-2: the first serving team gets one server only.
// - Each team has a base player: the one who starts on the right (even) side. The serving team's base
//   player serves first.
// - Serving team wins the rally: +1 point, and the server swaps sides with their partner.
// - Serving team loses it: server 1 hands over to server 2; after server 2 it's a side out.
// - After a side out, the player on the right-hand side serves first.
// - First to GAME_TO, win by 2.
//
// The umpire can also correct the state: make a player the server (as 1st or 2nd server), or swap a
// team's sides when players stood wrong. Corrections are events too, so Undo removes them like rallies.

export const GAME_TO = 11;

export type ScoreEvent =
  | { kind: "rally"; winner: 1 | 2 }
  | { kind: "server"; playerId: string; serverNo: 1 | 2 }
  | { kind: "swap"; team: 1 | 2 };

export interface SideoutScore {
  score1: number;
  score2: number;
  serving: 1 | 2;
  server: 1 | 2; // first or second server of the serving team
  serverId: string | null;
  right1: string | null; // who stands on team 1's right (even) side now
  right2: string | null;
  call: string; // what the server calls out: serving score, receiving score, server number
  winner: 1 | 2 | null;
  rallies: number; // rallies that counted (any after the game ended are ignored)
  events: number; // all events in the log, so the next one is numbered correctly
}

/**
 * `team1` and `team2` are player ids. `base` names each team's base player (starts on the right);
 * a missing or unknown base falls back to the first player listed.
 */
export function sideoutScore(
  firstServer: 1 | 2,
  events: readonly ScoreEvent[],
  team1: string[],
  team2: string[],
  base: { 1?: string | null; 2?: string | null } = {},
): SideoutScore {
  const teams = { 1: team1, 2: team2 };
  const score = { 1: 0, 2: 0 };
  const startRight = (t: 1 | 2) => (base[t] && teams[t].includes(base[t]!) ? base[t]! : (teams[t][0] ?? null));
  const right: Record<1 | 2, string | null> = { 1: startRight(1), 2: startRight(2) };
  const partnerOf = (team: 1 | 2, id: string | null) => teams[team].find((p) => p !== id) ?? id;
  const teamOf = (id: string): 1 | 2 | null => (team1.includes(id) ? 1 : team2.includes(id) ? 2 : null);
  let serving = firstServer;
  let server: 1 | 2 = 2; // first-server exception
  let serverId = right[firstServer];
  let winner: 1 | 2 | null = null;
  let counted = 0;

  for (const e of events) {
    if (e.kind === "server") {
      const team = teamOf(e.playerId);
      if (!team) continue;
      serving = team;
      server = e.serverNo;
      serverId = e.playerId;
      // The server stands on the right when their team's score is even, on the left when odd.
      right[team] = score[team] % 2 === 0 ? e.playerId : partnerOf(team, e.playerId);
      continue;
    }
    if (e.kind === "swap") {
      right[e.team] = partnerOf(e.team, right[e.team]);
      continue;
    }
    if (winner) continue; // rallies after the game ended don't count
    counted++;
    if (e.winner === serving) {
      score[serving]++;
      right[serving] = partnerOf(serving, right[serving]); // server and partner swap sides
      const other = serving === 1 ? 2 : 1;
      if (score[serving] >= GAME_TO && score[serving] - score[other] >= 2) winner = serving;
    } else if (server === 1) {
      server = 2;
      serverId = partnerOf(serving, serverId);
    } else {
      serving = serving === 1 ? 2 : 1;
      server = 1;
      serverId = right[serving];
    }
  }

  const receiving = serving === 1 ? 2 : 1;
  return {
    score1: score[1],
    score2: score[2],
    serving,
    server,
    serverId,
    right1: right[1],
    right2: right[2],
    call: `${score[serving]}-${score[receiving]}-${server}`,
    winner,
    rallies: counted,
    events: events.length,
  };
}

/**
 * Players in the order the court diagram draws them (top box, bottom box), matching where they stand.
 * Team 1 plays the left half facing right, so its right-hand side is the bottom box; team 2 faces left,
 * so its right-hand side is the top box.
 */
export function courtOrder<P extends { id: string }>(
  team1: P[],
  team2: P[],
  right1: string | null,
  right2: string | null,
): { team1: P[]; team2: P[] } {
  const split = (team: P[], rightId: string | null) => {
    const r = team.find((p) => p.id === rightId);
    return r ? { right: r, other: team.filter((p) => p !== r) } : null;
  };
  const a = split(team1, right1);
  const b = split(team2, right2);
  return {
    team1: a ? [...a.other, a.right] : team1,
    team2: b ? [b.right, ...b.other] : team2,
  };
}
