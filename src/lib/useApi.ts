import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, api } from "./api";
import { navigate } from "./router";

/** Loads an organizer API path; sends the person to log in if their login ended. */
export function useApi<T>(path: string | null, options: { pollMs?: number } = {}) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(path !== null);
  const [version, setVersion] = useState(0);
  const busy = useRef(false);
  const latest = useRef<T | null>(null);
  latest.current = data;

  useEffect(() => {
    if (path === null) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    api<T>(path)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          navigate("/login", { replace: true });
          return;
        }
        setError(err instanceof Error ? err.message : "Something went wrong.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [path, version]);

  // Quiet refresh while the page is visible, so several phones stay in sync.
  const { pollMs } = options;
  useEffect(() => {
    if (path === null || !pollMs) return;
    const tick = () => {
      if (document.visibilityState !== "visible" || busy.current) return;
      busy.current = true;
      // Send the version we have; the server replies "unchanged" if nothing happened.
      const version = (latest.current as { version?: unknown } | null)?.version;
      const url = typeof version === "number" ? `${path}${path.includes("?") ? "&" : "?"}v=${version}` : path;
      api<T | { unchanged: true; serverTime: number }>(url)
        .then((d) => {
          if (d && typeof d === "object" && "unchanged" in d) {
            // Keep the data; refresh only the server clock used for game timers.
            setData((prev) => (prev && typeof prev === "object" && "serverTime" in prev ? { ...prev, serverTime: d.serverTime } : prev));
          } else setData(d as T);
        })
        .catch(() => {
          // Keep showing the last good data; the next tick tries again.
        })
        .finally(() => {
          busy.current = false;
        });
    };
    const timer = setInterval(tick, pollMs);
    const onVisible = () => document.visibilityState === "visible" && tick();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [path, pollMs]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { data, setData, error, loading, reload };
}

/** Re-renders every `ms` so clocks and "waiting 4 min" stay current. */
export function useNow(ms = 1000): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}
