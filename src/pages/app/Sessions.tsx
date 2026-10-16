import { type FormEvent, useState } from "react";
import type { Me, SessionState, SessionSummary } from "../../../shared/types";
import { Icon } from "../../components/Icon";
import { api, errorMessage } from "../../lib/api";
import { dateLabel, defaultSessionTitle, plural, timeLabel } from "../../lib/format";
import { Link, navigate, useSearch } from "../../lib/router";
import { useApi } from "../../lib/useApi";

export function Sessions() {
  const historyOnly = useSearch().has("history");
  const { data: me } = useApi<Me>("/api/me");
  const { data: sessions, error } = useApi<SessionSummary[]>("/api/sessions");
  const live = sessions?.find((s) => s.status === "live");
  const past = sessions?.filter((s) => s.status === "ended") ?? [];

  return (
    <div className="page">
      {!historyOnly && (
        <>
          <div className="page-head">
            <div>
              <h1>{live ? "Session running" : "Start a session"}</h1>
              <p className="muted">{live ? "Open the courts to keep the line moving." : "Set the courts you booked, then check players in."}</p>
            </div>
          </div>
          {live ? (
            <Link to={`/app/session/${live.id}`} className="panel row spread" style={{ textDecoration: "none" }}>
              <span className="stack" style={{ gap: 4 }}>
                <span className="row">
                  <span className="pill pill-live">Live</span>
                  <h2>{live.title}</h2>
                </span>
                <span className="muted">
                  {plural(live.courtCount, "court")}, {plural(live.playerCount, "player")}, {plural(live.gameCount, "game")} so far
                </span>
              </span>
              <span className="btn btn-primary">Open courts</span>
            </Link>
          ) : (
            me && <StartForm />
          )}
        </>
      )}

      <section>
        <div className="section-head">
          <h2>{historyOnly ? "History" : "Past sessions"}</h2>
        </div>
        {error && <p className="form-error">{error}</p>}
        {sessions && past.length === 0 && (
          <div className="panel empty">
            <p className="muted">Finished sessions show up here with each player's wins and games.</p>
          </div>
        )}
        {past.length > 0 && (
          <ul className="pick-list">
            {past.map((s) => (
              <li key={s.id}>
                <Link to={`/app/session/${s.id}`} className="pick" style={{ textDecoration: "none" }}>
                  <span>
                    <span style={{ display: "block" }}>{s.title}</span>
                    <span className="muted small">
                      {dateLabel(s.createdAt)}, {timeLabel(s.createdAt)}
                      {s.venue ? `, ${s.venue}` : ""}
                    </span>
                  </span>
                  <span className="muted small num">
                    {plural(s.gameCount, "game")}
                    <br />
                    {plural(s.playerCount, "player")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function StartForm() {
  const [title, setTitle] = useState(defaultSessionTitle());
  const [venue, setVenue] = useState("");
  const [courts, setCourts] = useState(3);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const state = await api<SessionState>("/api/sessions", { method: "POST", body: { title, venue, courtCount: courts } });
      navigate(`/app/session/${state.session.id}`);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <form className="panel stack" onSubmit={submit} noValidate>
      <div className="field">
        <label htmlFor="title">Session name</label>
        <input id="title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} required />
      </div>
      <div className="field">
        <label htmlFor="venue">Venue</label>
        <input id="venue" className="input" value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="Optional" />
      </div>
      <div className="row spread">
        <div>
          <span style={{ fontWeight: 650 }}>Courts booked</span>
          <p className="muted small">You can change this during the session.</p>
        </div>
        <div className="stepper">
          <button type="button" onClick={() => setCourts((c) => Math.max(1, c - 1))} aria-label="One court fewer" disabled={courts <= 1}>
            <Icon name="minus" />
          </button>
          <output aria-live="polite" aria-label={`${courts} courts`}>
            {courts}
          </output>
          <button type="button" onClick={() => setCourts((c) => Math.min(12, c + 1))} aria-label="One more court" disabled={courts >= 12}>
            <Icon name="plus" />
          </button>
        </div>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
        {busy ? "Starting…" : "Start session"}
      </button>
    </form>
  );
}
