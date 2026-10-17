// How Up Next builds each game. The weights live in worker/queue.ts.

export const MATCH_MODES = {
  balanced: {
    label: "Balanced",
    badge: "Recommended",
    description: "Fair teams by skill level, and new partners each game when possible.",
  },
  social: {
    label: "Social mix",
    badge: null,
    description: "Play with as many different people as possible. Skill levels are ignored.",
  },
  skill: {
    label: "Skill groups",
    badge: null,
    description: "Similar levels play together on the same court. Good when your group's levels vary a lot.",
  },
  winners: {
    label: "Winners vs winners",
    badge: null,
    description: "After each game, winners face other winners and losers face losers.",
  },
} as const;

export type MatchMode = keyof typeof MATCH_MODES;
export const MATCH_MODE_KEYS = Object.keys(MATCH_MODES) as [MatchMode, ...MatchMode[]];

export function matchModeOf(key: string | null | undefined): MatchMode {
  return key && key in MATCH_MODES ? (key as MatchMode) : "balanced";
}
