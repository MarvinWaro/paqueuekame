import { customColorsOf } from "../shared/courtThemes";
import type { Team } from "../shared/types";
import type { Env } from "./env";
import { HttpError, getCookie, serializeCookie } from "./http";
import { randomToken, sha256Hex } from "./ids";

// PBKDF2 iterations. The Workers free plan allows about 10 ms of CPU per request,
// so this stays modest. The count is saved inside each hash, so it can be raised later.
const PBKDF2_ITERATIONS = 20_000;

export const LOGIN_COOKIE = "pq_login";
const LOGIN_DAYS = 30;

function toB64(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function fromB64(value: string): Uint8Array<ArrayBuffer> {
  const bin = atob(value);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function pbkdf2(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256);
  return new Uint8Array(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2-sha256$${PBKDF2_ITERATIONS}$${toB64(salt)}$${toB64(hash)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, iter, salt, hash] = stored.split("$");
  if (scheme !== "pbkdf2-sha256" || !iter || !salt || !hash) return false;
  const expected = fromB64(hash);
  const actual = await pbkdf2(password, fromB64(salt), Number(iter));
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
  return diff === 0;
}

export async function createLogin(env: Env, req: Request, organizerId: string): Promise<string> {
  const token = randomToken();
  const now = Date.now();
  await env.DB.prepare("INSERT INTO logins (token_hash, organizer_id, expires_at, created_at) VALUES (?, ?, ?, ?)")
    .bind(await sha256Hex(token), organizerId, now + LOGIN_DAYS * 86400000, now)
    .run();
  return serializeCookie(req, LOGIN_COOKIE, token, LOGIN_DAYS * 86400);
}

export async function destroyLogin(env: Env, req: Request): Promise<string> {
  const token = getCookie(req, LOGIN_COOKIE);
  if (token) await env.DB.prepare("DELETE FROM logins WHERE token_hash = ?").bind(await sha256Hex(token)).run();
  return serializeCookie(req, LOGIN_COOKIE, "", 0);
}

export interface OrganizerRow {
  id: string;
  team_id: string;
  name: string;
  email: string;
  password_hash: string;
  failed_logins: number;
  locked_until: number;
  created_at: number;
}

export interface Auth {
  organizer: OrganizerRow;
  team: Team & { timezone: string };
}

/** The logged-in organizer and their team. Throws 401 when the login is missing or expired. */
export async function requireOrganizer(env: Env, req: Request): Promise<Auth> {
  const token = getCookie(req, LOGIN_COOKIE);
  if (!token) throw new HttpError(401, "Log in to continue.", "unauthenticated");
  const row = await env.DB.prepare(
    `SELECT o.*, t.slug AS t_slug, t.name AS t_name, t.timezone AS t_timezone, t.court_theme AS t_court_theme,
       t.court_color AS t_court_color, t.kitchen_color AS t_kitchen_color
     FROM logins l
     JOIN organizers o ON o.id = l.organizer_id
     JOIN teams t ON t.id = o.team_id
     WHERE l.token_hash = ? AND l.expires_at > ?`,
  )
    .bind(await sha256Hex(token), Date.now())
    .first<
      OrganizerRow & {
        t_slug: string;
        t_name: string;
        t_timezone: string;
        t_court_theme: string;
        t_court_color: string | null;
        t_kitchen_color: string | null;
      }
    >();
  if (!row) throw new HttpError(401, "Your login ended. Log in again.", "unauthenticated");
  const { t_slug, t_name, t_timezone, t_court_theme, t_court_color, t_kitchen_color, ...organizer } = row;
  return {
    organizer,
    team: {
      id: organizer.team_id,
      slug: t_slug,
      name: t_name,
      timezone: t_timezone,
      courtTheme: t_court_theme,
      customColors: customColorsOf(t_court_color, t_kitchen_color),
    },
  };
}
