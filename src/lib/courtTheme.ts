import { useEffect } from "react";
import { type CourtColors, courtVars } from "../../shared/courtThemes";

/** Paints the courts in the team's colors, with lines and names in the ink that reads on them. */
export function applyCourtColors(colors: CourtColors): void {
  const root = document.documentElement.style;
  for (const [name, value] of Object.entries(courtVars(colors))) root.setProperty(name, value);
}

export function useCourtColors(colors: CourtColors | null | undefined): void {
  const court = colors?.court;
  const kitchen = colors?.kitchen;
  useEffect(() => {
    if (court && kitchen) applyCourtColors({ court, kitchen });
  }, [court, kitchen]);
}
