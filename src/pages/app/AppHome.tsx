import { useEffect } from "react";
import type { Me } from "../../../shared/types";
import { ApiError, api } from "../../lib/api";
import { navigate } from "../../lib/router";

/** /app opens the running session, or the page to start one. */
export function AppHome() {
  useEffect(() => {
    api<Me>("/api/me")
      .then((me) => navigate(me.liveSessionId ? `/app/session/${me.liveSessionId}` : "/app/sessions", { replace: true }))
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) navigate("/login", { replace: true });
        else navigate("/app/sessions", { replace: true });
      });
  }, []);
  return (
    <main className="auth">
      <p className="muted">Opening your courts…</p>
    </main>
  );
}
