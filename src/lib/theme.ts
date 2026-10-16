import { useSyncExternalStore } from "react";
import { readItem, writeItem } from "./storage";

export type Theme = "light" | "dark";
const listeners = new Set<() => void>();

function current(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

export function setTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#0D1824" : "#EEF2EF");
  writeItem("pq:theme", theme);
  listeners.forEach((l) => l());
}

export function useTheme(): [Theme, () => void] {
  const theme = useSyncExternalStore((cb) => {
    listeners.add(cb);
    return () => listeners.delete(cb);
  }, current);
  return [theme, () => setTheme(theme === "dark" ? "light" : "dark")];
}

/** Keeps the saved theme, or follows the phone's setting when nothing is saved. */
export function initTheme(): void {
  const saved = readItem("pq:theme");
  if (saved === "light" || saved === "dark") setTheme(saved);
}
