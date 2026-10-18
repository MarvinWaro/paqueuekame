import { type FormEvent, useEffect, useState } from "react";
import type { Me, Place, SessionState, SessionSummary } from "../../../shared/types";
import type { MatchMode } from "../../../shared/matchModes";
import { CourtStepper } from "../../components/CourtStepper";
import { ModePicker } from "../../components/ModePicker";
import { api, errorMessage } from "../../lib/api";
import { dateLabel, defaultSessionTitle, plural, timeLabel } from "../../lib/format";
import { Link, navigate } from "../../lib/router";
import { useApi } from "../../lib/useApi";
import type { DriveStep } from "driver.js";
import { useTour, visible } from "../../lib/tour";

export function Sessions() {
  const { data: me } = useApi<Me>("/api/me");
  const { data: sessions, error } = useApi<SessionSummary[]>("/api/sessions");
  const live = sessions?.find((s) => s.status === "live");
  const past = sessions?.filter((s) => s.status === "ended") ?? [];
  useTour("start", startTour, !!me && !!sessions && !live);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>{live ? "Session running" : "Start a session"}</h1>
          <p className="muted">{live ? "Open the courts to keep the line moving." : "Pick the place and courts you booked, then check players in."}</p>
        </div>
      </div>
      {live ? (
        <Link to={`/app/session/${live.id}`} className="panel row row-wrap spread" style={{ textDecoration: "none" }}>
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

      <section>
        <div className="section-head">
          <h2>Past sessions</h2>
          {past.length > 5 && (
            <Link to="/app/club?tab=sessions" className="btn btn-ghost btn-sm">
              See all
            </Link>
          )}
        </div>
        {error && <p className="form-error">{error}</p>}
        {sessions && <SessionList sessions={past.slice(0, 5)} />}
      </section>
    </div>
  );
}

/** First visit: where things live, before the first session. */
const startTour = (): DriveStep[] => [
  {
    popover: {
      title: "Welcome to NEXA",
      description: "A one-minute tour of how open play runs here. You can replay it any time from the Team tab.",
    },
  },
  {
    element: visible('[data-tour="nav-players"]'),
    popover: {
      title: "Your roster",
      description: "Add your club's players once. Paste a whole list from the group chat and set skill levels.",
    },
  },
  {
    element: '[data-tour="start-button"]',
    popover: {
      title: "Start a session",
      description: "Name it, pick the place and how many courts you booked, then tap Start session. Next you check players in.",
    },
  },
  {
    element: visible('[data-tour="nav-club"]'),
    popover: {
      title: "Club",
      description: "Leaderboards across sessions: most wins, best win rate and most active, by month or at one place.",
    },
  },
  {
    element: visible('[data-tour="nav-team"]'),
    popover: {
      title: "Team settings",
      description: "Court colors, other organizers, and this tour if you want it again.",
    },
  },
];

/** Finished sessions, newest first. */
export function SessionList({ sessions, empty }: { sessions: SessionSummary[]; empty?: string }) {
  if (sessions.length === 0) {
    return (
      <div className="panel empty">
        <p className="muted">{empty ?? "Finished sessions show up here with each player's wins and games."}</p>
      </div>
    );
  }
  return (
    <ul className="pick-list">
      {sessions.map((s) => (
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
  );
}

const NEW_PLACE = "new";

function StartForm() {
  const { data: places } = useApi<Place[]>("/api/places");
  const [title, setTitle] = useState(defaultSessionTitle());
  const [placeId, setPlaceId] = useState(""); // "" = no place
  const [newPlace, setNewPlace] = useState("");
  const [courts, setCourts] = useState(3);
  const [mode, setMode] = useState<MatchMode>("balanced");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Start where the team played last, with the courts usually booked there.
  useEffect(() => {
    const last = places?.[0];
    if (!last) return;
    setPlaceId(last.id);
    setCourts(last.courtCount);
  }, [places]);

  const pickPlace = (id: string) => {
    setPlaceId(id);
    const place = places?.find((p) => p.id === id);
    if (place) setCourts(place.courtCount);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const place =
      placeId === NEW_PLACE ? (newPlace.trim() ? { newPlace: newPlace.trim() } : {}) : placeId ? { placeId } : {};
    try {
      const state = await api<SessionState>("/api/sessions", { method: "POST", body: { title, courtCount: courts, mode, ...place } });
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
        <label htmlFor="place">Place</label>
        <select id="place" className="input" value={placeId} onChange={(e) => pickPlace(e.target.value)}>
          <option value="">No place</option>
          {places?.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({plural(p.courtCount, "court")})
            </option>
          ))}
          <option value={NEW_PLACE}>Add a new place…</option>
        </select>
        {placeId === NEW_PLACE && (
          <input
            className="input"
            value={newPlace}
            onChange={(e) => setNewPlace(e.target.value)}
            placeholder="e.g. AEON court"
            aria-label="New place name"
            maxLength={60}
            autoFocus
          />
        )}
        <span className="hint">The Club tab shows who's winning at each place.</span>
      </div>
      <div className="row spread">
        <div>
          <span style={{ fontWeight: 650 }}>Courts booked</span>
          <p className="muted small">You can change this during the session.</p>
        </div>
        <CourtStepper value={courts} onChange={setCourts} />
      </div>
      <div className="field">
        <span style={{ fontWeight: 650 }}>Matching mode</span>
        <ModePicker value={mode} onChange={setMode} />
        <span className="hint">You can switch modes during the session.</span>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button className="btn btn-primary btn-block" type="submit" disabled={busy} data-tour="start-button">
        {busy ? "Starting…" : "Start session"}
      </button>
    </form>
  );
}
