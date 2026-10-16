import type { Player } from "../../shared/types";

export function names(team: Player[]): string {
  return team.map((p) => p.name).join(" & ");
}

/** "3 min", "1 hr 5 min" */
export function minutes(total: number): string {
  const m = Math.max(0, Math.round(total));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return m % 60 ? `${h} hr ${m % 60} min` : `${h} hr`;
}

export function since(ms: number, now: number): string {
  return minutes((now - ms) / 60000);
}

/** Game clock: "12:04" */
export function clock(ms: number, now: number): string {
  const s = Math.max(0, Math.floor((now - ms) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function dateLabel(ms: number): string {
  return new Intl.DateTimeFormat("en-PH", { weekday: "short", month: "short", day: "numeric" }).format(new Date(ms));
}

export function timeLabel(ms: number): string {
  return new Intl.DateTimeFormat("en-PH", { hour: "numeric", minute: "2-digit" }).format(new Date(ms));
}

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function defaultSessionTitle(now = Date.now()): string {
  const day = new Intl.DateTimeFormat("en-PH", { weekday: "long" }).format(new Date(now));
  return `${day} open play`;
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}
