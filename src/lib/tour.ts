// Guided tours for organizers, built on driver.js. The library and its CSS load only when a tour
// runs, so nobody else downloads them. Each tour plays once per phone; Team settings can replay them.
import type { DriveStep, Driver } from "driver.js";
import { useEffect } from "react";

export type TourName = "start" | "court";
const TOURS: TourName[] = ["start", "court"];
const key = (name: TourName) => `pq:tour:${name}`;

function seen(name: TourName): boolean {
  try {
    return localStorage.getItem(key(name)) === "1";
  } catch {
    return true; // storage blocked: don't nag on every visit
  }
}

function markSeen(name: TourName) {
  try {
    localStorage.setItem(key(name), "1");
  } catch {
    // nothing to do
  }
}

/** Plays every tour again from the start. */
export function resetTours() {
  try {
    TOURS.forEach((name) => localStorage.removeItem(key(name)));
  } catch {
    // nothing to do
  }
}

/** The first element on the page that is actually showing (the top nav and the bottom nav share targets). */
export function visible(selector: string): () => Element {
  return () =>
    Array.from(document.querySelectorAll<HTMLElement>(selector)).find((el) => el.offsetParent !== null) ??
    document.body;
}

async function start(name: TourName, steps: DriveStep[]): Promise<Driver> {
  const [{ driver }] = await Promise.all([import("driver.js"), import("driver.js/dist/driver.css")]);
  const tour = driver({
    steps,
    animate: !matchMedia("(prefers-reduced-motion: reduce)").matches,
    popoverClass: "nexa-tour",
    overlayColor: "#09090b",
    overlayOpacity: 0.6,
    stagePadding: 6,
    stageRadius: 12,
    showProgress: true,
    progressText: "{{current}} of {{total}}",
    nextBtnText: "Next",
    prevBtnText: "Back",
    doneBtnText: "Done",
    closeBtnLabel: "Close the tour",
    onDestroyed: () => markSeen(name),
  });
  tour.drive();
  return tour;
}

/** Plays a tour once per phone, as soon as `ready` (the screen has its data). Leaving the screen ends it. */
export function useTour(name: TourName, steps: () => DriveStep[], ready: boolean) {
  useEffect(() => {
    if (!ready || seen(name)) return;
    let tour: Driver | null = null;
    let cancelled = false;
    const timer = setTimeout(() => {
      start(name, steps()).then((t) => {
        if (cancelled) t.destroy();
        else tour = t;
      });
    }, 600); // let the screen settle first
    return () => {
      cancelled = true;
      clearTimeout(timer);
      tour?.destroy();
    };
  }, [ready, name]);
}
