// The standings order, used by the Worker to rank and by the app to explain a rank.
// The tie note in src/pages/Results.tsx says the same thing in words; keep them in sync.
import type { Standing } from "./types";

const RULES = [
  { name: "wins", value: (s: Standing) => s.wins },
  { name: "win rate", value: (s: Standing) => s.winRate },
  { name: "opponent strength", value: (s: Standing) => s.oppStrength },
  { name: "point difference", value: (s: Standing) => s.pointDiff },
] as const;

export type RankRule = (typeof RULES)[number]["name"] | "name";

export function compareStandings(a: Standing, b: Standing): number {
  for (const rule of RULES) {
    const d = rule.value(b) - rule.value(a);
    if (d !== 0) return d;
  }
  return a.player.name.localeCompare(b.player.name);
}

/** The first rule that puts `ahead` above `behind`. */
export function decidingRule(ahead: Standing, behind: Standing): RankRule {
  return RULES.find((rule) => rule.value(ahead) !== rule.value(behind))?.name ?? "name";
}
