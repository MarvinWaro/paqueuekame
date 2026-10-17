// Real court color combinations: the playing area, and the kitchen (non-volley zone) by the net.
// Lines are always white. Dark mode darkens these automatically in styles.css.

export const COURT_THEMES = {
  // The NEXA look and the default for new teams: a terracotta nude (orange, not brown) that keeps
  // white names readable (4.54:1), with a warm gray kitchen.
  nexa: { label: "NEXA nude", court: "#b0613f", kitchen: "#57534e" },
  classic: { label: "Classic", court: "#2a5c96", kitchen: "#2e7d5f" },
  pro: { label: "Pro blue", court: "#1d3f73", kitchen: "#4a86c8" },
  green: { label: "All green", court: "#2f6b4a", kitchen: "#5c9a6e" },
  purple: { label: "Purple", court: "#4e3a86", kitchen: "#2f6fae" },
  clay: { label: "Clay", court: "#a4493a", kitchen: "#2f6a8f" },
  indoor: { label: "Indoor gray", court: "#3d4650", kitchen: "#2c7a78" },
} as const;

export type CourtTheme = keyof typeof COURT_THEMES;
/** New teams start with the NEXA look; existing teams keep what they picked. */
export const DEFAULT_COURT_THEME: CourtTheme = "nexa";
export const COURT_THEME_KEYS = Object.keys(COURT_THEMES) as [CourtTheme, ...CourtTheme[]];

export function courtThemeOf(key: string | null | undefined): CourtTheme {
  return key && key in COURT_THEMES ? (key as CourtTheme) : DEFAULT_COURT_THEME;
}

/** "custom" paints the courts in the team's own colors (teams.court_color, teams.kitchen_color). */
export const CUSTOM_THEME = "custom";
export const THEME_CHOICES = [...COURT_THEME_KEYS, CUSTOM_THEME] as [string, ...string[]];

export interface CourtColors {
  court: string;
  kitchen: string;
}

export function customColorsOf(court: string | null, kitchen: string | null): CourtColors | null {
  return court && kitchen ? { court, kitchen } : null;
}

/** The two colors to paint: the custom pair when picked and saved, otherwise the preset. */
export function courtColorsOf(theme: string | null | undefined, custom: CourtColors | null): CourtColors {
  if (theme === CUSTOM_THEME && custom) return custom;
  const { court, kitchen } = COURT_THEMES[courtThemeOf(theme)];
  return { court, kitchen };
}

export const HEX_COLOR = /^#[0-9a-f]{6}$/;

export function normalizeHex(value: string): string {
  const v = value.trim().toLowerCase();
  return v.startsWith("#") ? v : `#${v}`;
}

// White lines sit on both areas (3:1). The court color also backs white button text, so it needs 4.5:1.
const MIN_CONTRAST: Record<keyof CourtColors, number> = { court: 4.5, kitchen: 3 };

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Why a custom color can't be used, in words for the organizer, or null when it's fine. */
export function courtColorProblem(area: keyof CourtColors, hex: string): string | null {
  if (!HEX_COLOR.test(hex)) return `Enter the ${area} color as 6 hex digits, like #2a5c96.`;
  if (1.05 / (luminance(hex) + 0.05) >= MIN_CONTRAST[area]) return null;
  return area === "court"
    ? "This court color is too light for white lines and button text. Pick a darker shade."
    : "This kitchen color is too light for the white lines. Pick a darker shade.";
}
