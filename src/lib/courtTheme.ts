import { useEffect } from "react";
import type { CourtColors } from "../../shared/courtThemes";

/** Paints the courts in the team's colors. Everything else in styles.css derives from these two. */
export function applyCourtColors({ court, kitchen }: CourtColors): void {
  const root = document.documentElement.style;
  root.setProperty("--tc-court", court);
  root.setProperty("--tc-kitchen", kitchen);
}

export function useCourtColors(colors: CourtColors | null | undefined): void {
  const court = colors?.court;
  const kitchen = colors?.kitchen;
  useEffect(() => {
    if (court && kitchen) applyCourtColors({ court, kitchen });
  }, [court, kitchen]);
}
