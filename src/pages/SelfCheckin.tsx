import { useState } from "react";
import type { CheckinRoster, Player, SessionState } from "../../shared/types";
import { Brand } from "../components/Brand";
import { NamePicker } from "../components/NamePicker";
import { Sheet } from "../components/Sheet";
import { ThemeToggle } from "../components/ThemeToggle";
import { api, errorMessage } from "../lib/api";
import { navigate, useSearch } from "../lib/router";
import { codeKey, meKey, readItem, writeItem } from "../lib/storage";
import { useApi } from "../lib/useApi";

/** Opened from the QR code at the court. The player taps their name and joins the line. */
export function SelfCheckin({ token }: { token: string }) {
  const k = useSearch().get("k") ?? "";
  const { data: roster, error } = useApi<CheckinRoster>(`/api/live/${token}/roster?k=${encodeURIComponent(k)}`);
  const [picked, setPicked] = useState<Player | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  // Tapped "I'm coming" (or checked in before) on this phone? Offer that name first.
  const known = roster?.players.find((p) => p.id === readItem(meKey(token))) ?? null;

  const checkIn = async (body: { playerId?: string; name?: string }) => {
    setBusy(true);
    setFailure(null);
    try {
      const res = await api<{ playerId: string; state: SessionState }>(`/api/live/${token}/checkin`, { method: "POST", body: { k, ...body } });
      writeItem(meKey(token), res.playerId);
      writeItem(codeKey(token), k);
      navigate(`/live/${token}`, { replace: true });
    } catch (err) {
      setFailure(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <main className="auth" style={{ alignItems: "start" }}>
      <div className="auth-card">
        <div className="row spread">
          <Brand />
          <ThemeToggle />
        </div>
        {error && (
          <div className="panel empty">
            <h1>Can't check in here</h1>
            <p className="muted">{error}</p>
            <button type="button" className="btn" onClick={() => navigate(`/live/${token}`)}>
              See the courts
            </button>
          </div>
        )}
        {roster && (
          <>
            <div>
              <p className="muted">{roster.teamName}</p>
              <h1>Check in to {roster.sessionTitle}</h1>
            </div>
            {known && (
              <div className="panel stack" style={{ gap: 10 }}>
                <button type="button" className="btn btn-primary btn-block" disabled={busy} onClick={() => checkIn({ playerId: known.id })}>
                  {busy ? "Checking in…" : `I'm here: check in as ${known.name}`}
                </button>
                <p className="muted small">Not {known.name}? Find your name below.</p>
              </div>
            )}
            <NamePicker
              players={roster.players}
              busy={busy}
              failure={picked ? null : failure}
              onPick={setPicked}
              onGuest={(name) => checkIn({ name })}
            />
          </>
        )}
      </div>

      {picked && (
        <Sheet title={`Check in as ${picked.name}?`} onClose={() => setPicked(null)}>
          <p className="muted">You'll join the back of the line. This phone will show your place and buzz when you're up.</p>
          {failure && (
            <p className="form-error" role="alert">
              {failure}
            </p>
          )}
          <button type="button" className="btn btn-primary btn-block" disabled={busy} onClick={() => checkIn({ playerId: picked.id })}>
            {busy ? "Checking in…" : `Check in as ${picked.name}`}
          </button>
        </Sheet>
      )}
    </main>
  );
}
