import { type FormEvent, useState } from "react";
import type { LeaderRow, Leaderboard, LeaderboardRange, Place, SessionSummary } from "../../../shared/types";
import { CourtStepper } from "../../components/CourtStepper";
import { Icon } from "../../components/Icon";
import { Sheet } from "../../components/Sheet";
import { useToast } from "../../components/Toast";
import { api, errorMessage } from "../../lib/api";
import { dateLabel, plural } from "../../lib/format";
import { navigate, useSearch } from "../../lib/router";
import { useApi } from "../../lib/useApi";
import { Medal } from "../Results";
import { SessionList } from "./Sessions";

type Tab = "leaders" | "sessions" | "places";

const RANGES: [LeaderboardRange, string][] = [
  ["month", "This month"],
  ["last-month", "Last month"],
  ["all", "All time"],
];

// Win rate only means something after a few games.
const minGamesFor = (range: LeaderboardRange) => (range === "all" ? 10 : 5);

export function Club() {
  const initial = useSearch().get("tab");
  const [tab, setTab] = useState<Tab>(initial === "sessions" || initial === "places" ? initial : "leaders");
  const [placeId, setPlaceId] = useState("");
  const { data: places, setData: setPlaces } = useApi<Place[]>("/api/places");

  // Keep the tab in the address, so Back from a session returns to the same tab.
  const selectTab = (key: Tab) => {
    setTab(key);
    navigate(key === "leaders" ? "/app/club" : `/app/club?tab=${key}`, { replace: true });
  };

  const showPlace = (id: string) => {
    setPlaceId(id);
    selectTab("leaders");
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Club</h1>
          <p className="muted">Who's active and who's winning, across all your sessions or at one place.</p>
        </div>
      </div>

      <div className="tabs" role="tablist" aria-label="Club">
        {(
          [
            ["leaders", "Leaderboard"],
            ["sessions", "Sessions"],
            ["places", "Places"],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => selectTab(key)}>
            {label}
          </button>
        ))}
      </div>

      {tab !== "places" && places && places.length > 0 && (
        <div className="field">
          <label htmlFor="club-place" className="small">
            Place
          </label>
          <select id="club-place" className="input" value={placeId} onChange={(e) => setPlaceId(e.target.value)}>
            <option value="">All places</option>
            {places.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {tab === "leaders" && <Leaders placeId={placeId} placeName={places?.find((p) => p.id === placeId)?.name} />}
      {tab === "sessions" && <PastSessions placeId={placeId} />}
      {tab === "places" && places && <Places places={places} setPlaces={setPlaces} onShow={showPlace} />}
    </div>
  );
}

// ---------- Leaderboard ----------

function Leaders({ placeId, placeName }: { placeId: string; placeName?: string }) {
  const [range, setRange] = useState<LeaderboardRange>("month");
  const query = new URLSearchParams({ range, ...(placeId ? { place: placeId } : {}) });
  const { data: board, error } = useApi<Leaderboard>(`/api/club/leaderboard?${query}`);
  const minGames = minGamesFor(range);
  const where = `${RANGES.find(([r]) => r === range)![1].toLowerCase()}${placeName ? ` at ${placeName}` : ""}`;

  return (
    <div className="stack">
      <div className="seg" role="radiogroup" aria-label="Time range">
        {RANGES.map(([key, label]) => (
          <button key={key} type="button" role="radio" aria-checked={range === key} onClick={() => setRange(key)}>
            {label}
          </button>
        ))}
      </div>
      {error && <p className="form-error">{error}</p>}
      {board &&
        (board.sessions === 0 ? (
          <div className="panel empty">
            <p className="muted">No sessions {where} yet.</p>
          </div>
        ) : (
          <>
            <div className="summary-tiles panel">
              <div>
                <b>{board.sessions}</b>
                <span>{board.sessions === 1 ? "session" : "sessions"}</span>
              </div>
              <div>
                <b>{board.games}</b>
                <span>{board.games === 1 ? "game" : "games"}</span>
              </div>
              <div>
                <b>{board.rows.length}</b>
                <span>{board.rows.length === 1 ? "player" : "players"}</span>
              </div>
            </div>
            <div className="two-col">
              <Board
                title="Most wins"
                hint={`Total wins ${where}.`}
                rows={board.rows
                  .filter((r) => r.wins > 0)
                  .sort((a, b) => b.wins - a.wins || rate(b) - rate(a) || a.player.name.localeCompare(b.player.name))}
                value={(r) => String(r.wins)}
                unit={(r) => (r.wins === 1 ? "win" : "wins")}
                meta={(r) => `${pct(rate(r))} win rate, ${plural(r.games, "game")}`}
                empty="No wins recorded yet."
              />
              <Board
                title="Best win rate"
                hint={`At least ${minGames} games ${where}.`}
                rows={board.rows
                  .filter((r) => r.games >= minGames)
                  .sort((a, b) => rate(b) - rate(a) || b.wins - a.wins || a.player.name.localeCompare(b.player.name))}
                value={(r) => pct(rate(r))}
                unit={() => "win rate"}
                meta={(r) => `${r.wins}–${r.games - r.wins} in ${plural(r.games, "game")}`}
                empty={`No one has played ${minGames} games yet.`}
              />
              <Board
                title="Most active"
                hint={`Sessions attended ${where}.`}
                rows={[...board.rows].sort(
                  (a, b) => b.sessions - a.sessions || b.games - a.games || a.player.name.localeCompare(b.player.name),
                )}
                value={(r) => String(r.sessions)}
                unit={(r) => (r.sessions === 1 ? "session" : "sessions")}
                meta={(r) => plural(r.games, "game")}
                empty="No one checked in yet."
              />
            </div>
          </>
        ))}
    </div>
  );
}

const rate = (r: LeaderRow) => (r.games ? r.wins / r.games : 0);
const pct = (x: number) => `${Math.round(x * 100)}%`;
const PREVIEW = 5;

function Board(props: {
  title: string;
  hint: string;
  rows: LeaderRow[];
  value: (r: LeaderRow) => string;
  unit: (r: LeaderRow) => string;
  meta: (r: LeaderRow) => string;
  empty: string;
}) {
  const { title, hint, rows, value, unit, meta, empty } = props;
  const [all, setAll] = useState(false);
  return (
    <section className="panel">
      <div className="section-head" style={{ marginBottom: 0 }}>
        <h2>{title}</h2>
      </div>
      <p className="muted small" style={{ marginBottom: 6 }}>
        {hint}
      </p>
      {rows.length === 0 ? (
        <p className="muted">{empty}</p>
      ) : (
        <>
          <ol className="standings">
            {rows.slice(0, all ? undefined : PREVIEW).map((r, i) => (
              <li key={r.player.id}>
                <div className={`standing ${i < 3 ? "is-podium" : ""}`}>
                  <Medal rank={i + 1} />
                  <span className="standing-main">
                    <span className="standing-name">{r.player.name}</span>
                    <span className="standing-meta">{meta(r)}</span>
                  </span>
                  <span className="standing-wins">
                    <b>{value(r)}</b>
                    {unit(r)}
                  </span>
                </div>
              </li>
            ))}
          </ol>
          {rows.length > PREVIEW && (
            <button type="button" className="btn btn-ghost btn-block" onClick={() => setAll(!all)}>
              {all ? "Show top 5" : `Show all ${rows.length}`}
            </button>
          )}
        </>
      )}
    </section>
  );
}

// ---------- Sessions ----------

function PastSessions({ placeId }: { placeId: string }) {
  const { data: sessions, error } = useApi<SessionSummary[]>("/api/sessions");
  if (error) return <p className="form-error">{error}</p>;
  if (!sessions) return null;
  const past = sessions.filter((s) => s.status === "ended" && (!placeId || s.placeId === placeId));
  return <SessionList sessions={past} empty={placeId ? "No finished sessions at this place yet." : undefined} />;
}

// ---------- Places ----------

function Places({ places, setPlaces, onShow }: { places: Place[]; setPlaces: (p: Place[]) => void; onShow: (id: string) => void }) {
  const [editing, setEditing] = useState<Place | null>(null);
  return (
    <div className="stack">
      {places.length === 0 ? (
        <div className="panel empty">
          <p className="muted">Add the places you play at. Each one gets its own leaderboard.</p>
        </div>
      ) : (
        <ul className="pick-list">
          {places.map((p) => (
            <li key={p.id} className="pick-row">
              <button type="button" className="pick" onClick={() => onShow(p.id)}>
                <span>
                  <span style={{ display: "block" }}>{p.name}</span>
                  <span className="muted small">
                    {plural(p.sessions, "session")}
                    {p.lastPlayedAt ? `, last on ${dateLabel(p.lastPlayedAt)}` : ""}, {plural(p.courtCount, "court")}
                  </span>
                </span>
                <span className="pick-go">
                  Leaderboard <Icon name="chevron" />
                </span>
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(p)} aria-label={`Edit ${p.name}`}>
                Edit
              </button>
            </li>
          ))}
        </ul>
      )}
      <AddPlace onAdded={(p) => setPlaces([p, ...places])} />
      {editing && (
        <EditPlace
          place={editing}
          onClose={() => setEditing(null)}
          onSaved={(p) => setPlaces(places.map((x) => (x.id === p.id ? p : x)))}
          onRemoved={(id) => setPlaces(places.filter((x) => x.id !== id))}
        />
      )}
    </div>
  );
}

function AddPlace({ onAdded }: { onAdded: (p: Place) => void }) {
  const [name, setName] = useState("");
  const [courts, setCourts] = useState(2);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      onAdded(await api<Place>("/api/places", { method: "POST", body: { name, courtCount: courts } }));
      toast(`${name.trim()} added`);
      setName("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className="panel stack" onSubmit={save} noValidate>
      <h2>Add a place</h2>
      <div className="field">
        <label htmlFor="place-name">Name</label>
        <input id="place-name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. AEON court" maxLength={60} />
      </div>
      <div className="row spread">
        <span style={{ fontWeight: 650 }}>Courts usually booked</span>
        <CourtStepper value={courts} onChange={setCourts} />
      </div>
      {error && <p className="form-error">{error}</p>}
      <button type="submit" className="btn btn-primary btn-block" disabled={busy || !name.trim()}>
        Add place
      </button>
    </form>
  );
}

function EditPlace({
  place,
  onClose,
  onSaved,
  onRemoved,
}: {
  place: Place;
  onClose: () => void;
  onSaved: (p: Place) => void;
  onRemoved: (id: string) => void;
}) {
  const [name, setName] = useState(place.name);
  const [courts, setCourts] = useState(place.courtCount);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();
  const patch = async (body: object) => api<Place>(`/api/places/${place.id}`, { method: "PATCH", body });

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      onSaved(await patch({ name, courtCount: courts }));
      toast("Place saved");
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    }
  };
  const remove = async () => {
    try {
      await patch({ archived: true });
      onRemoved(place.id);
      toast(`${place.name} removed`);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <Sheet title={`Edit ${place.name}`} onClose={onClose}>
      <form className="stack" onSubmit={save} noValidate>
        <div className="field">
          <label htmlFor="edit-place-name">Name</label>
          <input id="edit-place-name" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
        </div>
        <div className="row spread">
          <span style={{ fontWeight: 650 }}>Courts usually booked</span>
          <CourtStepper value={courts} onChange={setCourts} />
        </div>
        {error && <p className="form-error">{error}</p>}
        <button type="submit" className="btn btn-primary btn-block" disabled={!name.trim()}>
          Save place
        </button>
        <hr style={{ border: 0, borderTop: "1px solid var(--line)", width: "100%" }} />
        {confirm ? (
          <div className="stack" style={{ gap: 8 }}>
            <p className="small">
              Remove {place.name} from your places? Its {plural(place.sessions, "session")} keep the name, and adding it again brings it back.
            </p>
            <div className="row">
              <button type="button" className="btn btn-danger-solid" onClick={remove}>
                Remove {place.name}
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setConfirm(false)}>
                Keep
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="btn btn-ghost" onClick={() => setConfirm(true)}>
            Remove this place
          </button>
        )}
      </form>
    </Sheet>
  );
}
