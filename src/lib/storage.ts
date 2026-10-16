// localStorage can be missing or throw (private mode, blocked storage), so every access is guarded.

export function readItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage unavailable; things still work until the tab closes.
  }
}

export function removeItem(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

/** Which player this phone belongs to, per live session. */
export const meKey = (token: string) => `pq:me:${token}`;
/** The check-in code from the court QR, so this phone can take breaks and leave. */
export const codeKey = (token: string) => `pq:code:${token}`;
