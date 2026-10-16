// The matching engine. Pure functions, no database, so it's easy to test.
//
// Rules ("all 4 off, balanced"):
// 1. Line order is the base. The player who has waited longest always plays next.
// 2. Anyone passed over twice (MAX_SKIPS) must be in the next game.
// 3. Among the first few in line, pick the 4 players and team split that best avoid
//    repeat partners and repeat opponents, and keep the teams' skill close.
// 4. After a game, all 4 go to the back of the line.

export const POOL_SIZE = 8;
export const MAX_SKIPS = 2;

const W_WAIT = 10; // per place deeper in line
const W_PARTNER = 25; // per earlier game together as partners
const W_OPPONENT = 6; // per earlier game against each other
const W_SKILL = 8; // per skill point difference between the two teams
const DEFAULT_SKILL = 3;

export interface Waiting {
  id: string;
  skill: number | null;
  skips: number;
}

export interface Pick {
  team1: [string, string];
  team2: [string, string];
}

/** Counts of earlier games in this session, keyed by "idA|idB" (sorted). */
export interface History {
  partners: Map<string, number>;
  opponents: Map<string, number>;
}

export function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export function emptyHistory(): History {
  return { partners: new Map(), opponents: new Map() };
}

export function addGame(history: History, team1: string[], team2: string[]): void {
  const bump = (map: Map<string, number>, a: string, b: string) => {
    const k = pairKey(a, b);
    map.set(k, (map.get(k) ?? 0) + 1);
  };
  for (const team of [team1, team2]) {
    for (let i = 0; i < team.length; i++) for (let j = i + 1; j < team.length; j++) bump(history.partners, team[i], team[j]);
  }
  for (const a of team1) for (const b of team2) bump(history.opponents, a, b);
}

/** Canonical form of a match, so "the same game" can be recognised (used by Shuffle). */
export function matchKey(team1: string[], team2: string[]): string {
  const t1 = [...team1].sort().join("+");
  const t2 = [...team2].sort().join("+");
  return t1 < t2 ? `${t1}/${t2}` : `${t2}/${t1}`;
}

function combinations<T>(items: T[], k: number): T[][] {
  const out: T[][] = [];
  const walk = (start: number, acc: T[]) => {
    if (acc.length === k) {
      out.push(acc.slice());
      return;
    }
    for (let i = start; i <= items.length - (k - acc.length); i++) {
      acc.push(items[i]);
      walk(i + 1, acc);
      acc.pop();
    }
  };
  walk(0, []);
  return out;
}

/**
 * Picks the next doubles game from `line` (already in line order, longest wait first).
 * Returns null when fewer than 4 players are waiting.
 * `avoid` skips one exact game (matchKey), used when the organizer taps Shuffle.
 */
export function pickMatch(line: Waiting[], history: History, avoid?: string): Pick | null {
  if (line.length < 4) return null;
  const pool = line.slice(0, Math.min(POOL_SIZE, line.length));
  const index = new Map(pool.map((p, i) => [p.id, i]));

  const required = pool.filter((p, i) => i === 0 || p.skips >= MAX_SKIPS).slice(0, 4);
  const requiredIds = new Set(required.map((p) => p.id));
  const optional = pool.filter((p) => !requiredIds.has(p.id));

  let best: { cost: number; pick: Pick } | null = null;
  for (const extra of combinations(optional, 4 - required.length)) {
    const four = [...required, ...extra];
    const [a, b, c, d] = four;
    const waitCost = four.reduce((sum, p) => sum + index.get(p.id)!, 0) * W_WAIT;
    for (const [t1, t2] of [
      [
        [a, b],
        [c, d],
      ],
      [
        [a, c],
        [b, d],
      ],
      [
        [a, d],
        [b, c],
      ],
    ] as [Waiting[], Waiting[]][]) {
      const ids1 = t1.map((p) => p.id);
      const ids2 = t2.map((p) => p.id);
      if (avoid && matchKey(ids1, ids2) === avoid) continue;

      const partnerCost =
        ((history.partners.get(pairKey(ids1[0], ids1[1])) ?? 0) + (history.partners.get(pairKey(ids2[0], ids2[1])) ?? 0)) *
        W_PARTNER;
      let opponentCost = 0;
      for (const x of ids1) for (const y of ids2) opponentCost += (history.opponents.get(pairKey(x, y)) ?? 0) * W_OPPONENT;
      const skill = (team: Waiting[]) => team.reduce((s, p) => s + (p.skill ?? DEFAULT_SKILL), 0);
      const skillCost = Math.abs(skill(t1) - skill(t2)) * W_SKILL;

      const cost = waitCost + partnerCost + opponentCost + skillCost;
      if (!best || cost < best.cost) {
        best = { cost, pick: { team1: [ids1[0], ids1[1]], team2: [ids2[0], ids2[1]] } };
      }
    }
  }
  return best?.pick ?? null;
}

/**
 * Who got passed over when a game starts: players still waiting who were ahead in line
 * of the last-placed player chosen. Their skip count goes up by one.
 */
export function passedOver(line: { id: string }[], chosen: Set<string>): string[] {
  let last = -1;
  line.forEach((p, i) => {
    if (chosen.has(p.id)) last = i;
  });
  return line.slice(0, last + 1).filter((p) => !chosen.has(p.id)).map((p) => p.id);
}
