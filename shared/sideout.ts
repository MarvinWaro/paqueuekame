// Traditional side-out scoring for doubles, worked out from the list of rally winners.
// Used by the Worker (the real score) and the umpire's phone (instant feedback).
//
// Rules:
// - Only the serving team scores. The game starts at 0-0-2: the first serving team gets one server only.
// - Serving team wins the rally: +1 point, and the server swaps sides with their partner.
// - Serving team loses it: server 1 hands over to server 2; after server 2 it's a side out.
// - After a side out, the player on the right-hand side serves first.
// - First to GAME_TO, win by 2.

export const GAME_TO = 11;

export interface SideoutScore {
  score1: number;
  score2: number;
  serving: 1 | 2;
  server: 1 | 2; // first or second server of the serving team
  serverId: string | null;
  call: string; // what the server calls out: serving score, receiving score, server number
  winner: 1 | 2 | null;
  rallies: number; // rallies that counted (any after the game ended are ignored)
}

/**
 * `team1` and `team2` are player ids in court order; the first of each starts on the right-hand side.
 * `rallies` are the winners of each rally in order.
 */
export function sideoutScore(firstServer: 1 | 2, rallies: readonly (1 | 2)[], team1: string[], team2: string[]): SideoutScore {
  const teams = { 1: team1, 2: team2 };
  const score = { 1: 0, 2: 0 };
  const right: Record<1 | 2, string | null> = { 1: team1[0] ?? null, 2: team2[0] ?? null }; // who stands on the right
  const partnerOf = (team: 1 | 2, id: string | null) => teams[team].find((p) => p !== id) ?? id;
  let serving = firstServer;
  let server: 1 | 2 = 2; // first-server exception
  let serverId = right[firstServer];
  let winner: 1 | 2 | null = null;
  let counted = 0;

  for (const rally of rallies) {
    if (winner) break;
    counted++;
    if (rally === serving) {
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
    call: `${score[serving]}-${score[receiving]}-${server}`,
    winner,
    rallies: counted,
  };
}
