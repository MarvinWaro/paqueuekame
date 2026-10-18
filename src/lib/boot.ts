// Keeps the boot splash (index.html) up until the first screen has its data, so people see one
// NEXA loader instead of the splash followed by a "Loading…" line. A screen holds the splash while
// it shows <Loading />; the splash finishes once the app is mounted and nothing holds it.

declare global {
  interface Window {
    __nexaReady?: () => void;
  }
}

const MAX_HOLD_MS = 8000; // after this, let the screen's own loader show instead
let holds = 0;
let mounted = false;

function check() {
  // Deferred: React can release and re-take a hold in one commit (StrictMode, or one screen
  // handing over to the next), so look again once that has settled.
  setTimeout(() => {
    if (mounted && holds === 0) window.__nexaReady?.();
  }, 0);
}

/** Call once the app has rendered. */
export function appMounted() {
  if (mounted) return;
  mounted = true;
  check();
  setTimeout(() => window.__nexaReady?.(), MAX_HOLD_MS);
}

/** Hold the splash; returns the release function (use as an effect). */
export function holdBoot() {
  holds++;
  return () => {
    holds--;
    check();
  };
}
