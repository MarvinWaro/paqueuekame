import { type FormEvent, useMemo, useState } from "react";
import type { CheckinRoster, Player, SessionState } from "../../shared/types";
import { Brand } from "../components/Brand";
import { Icon } from "../components/Icon";
import { Sheet } from "../components/Sheet";
import { ThemeToggle } from "../components/ThemeToggle";
import { api, errorMessage } from "../lib/api";
import { navigate, useSearch } from "../lib/router";
import { codeKey, meKey, writeItem } from "../lib/storage";
import { useApi } from "../lib/useApi";

/** Opened from the QR code at the court. The player taps their name and joins the line. */
export function SelfCheckin({ token }: { token: string }) {
  const k = useSearch().get("k") ?? "";
  const { data: roster, error } = useApi<CheckinRoster>(`/api/live/${token}/roster?k=${encodeURIComponent(k)}`);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Player | null>(null);
  const [guest, setGuest] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (roster?.players ?? []).filter((p) => !q || p.name.toLowerCase().includes(q));
  }, [roster, query]);

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
            <div className="input-prefix">
              <span>
                <Icon name="search" />
              </span>
              <input className="input" type="search" placeholder="Find your name" aria-label="Find your name" value={query} onChange={(e) => setQuery(e.target.value)} autoFocus />
            </div>
            <ul className="pick-list">
              {shown.map((p) => (
                <li key={p.id}>
                  <button type="button" className="pick" onClick={() => setPicked(p)}>
                    {p.name}
                    {p.isGuest && <span className="pill pill-guest">Guest</span>}
                  </button>
                </li>
              ))}
            </ul>
            {shown.length === 0 && <p className="muted">No one called “{query}” on the list.</p>}
            <button type="button" className="btn btn-block" onClick={() => setGuest(true)}>
              I'm not on the list
            </button>
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
      {guest && <GuestForm busy={busy} failure={failure} onClose={() => setGuest(false)} onSubmit={(name) => checkIn({ name })} />}
    </main>
  );
}

function GuestForm({ busy, failure, onClose, onSubmit }: { busy: boolean; failure: string | null; onClose: () => void; onSubmit: (name: string) => void }) {
  const [name, setName] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (name.trim()) onSubmit(name.trim());
  };
  return (
    <Sheet title="Check in as a guest" onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <div className="field">
          <label htmlFor="guest-name">Your name</label>
          <input id="guest-name" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
          <span className="hint">Use the name your teammates call you.</span>
        </div>
        {failure && (
          <p className="form-error" role="alert">
            {failure}
          </p>
        )}
        <button type="submit" className="btn btn-primary btn-block" disabled={busy || !name.trim()}>
          {busy ? "Checking in…" : "Check in"}
        </button>
      </form>
    </Sheet>
  );
}
