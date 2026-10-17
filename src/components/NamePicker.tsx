import { type FormEvent, useMemo, useState } from "react";
import type { Player } from "../../shared/types";
import { Icon } from "./Icon";

/** Find-your-name list with a guest option, for the court QR and "I'm coming" from the group chat. */
export function NamePicker({
  players,
  busy,
  failure,
  onPick,
  onGuest,
}: {
  players: Player[];
  busy: boolean;
  failure: string | null;
  onPick: (p: Player) => void;
  onGuest: (name: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [guest, setGuest] = useState(false);
  const [name, setName] = useState("");
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return players.filter((p) => !q || p.name.toLowerCase().includes(q));
  }, [players, query]);

  const submitGuest = (e: FormEvent) => {
    e.preventDefault();
    if (name.trim()) onGuest(name.trim());
  };

  if (guest) {
    return (
      <form className="stack" onSubmit={submitGuest}>
        <div className="field">
          <label htmlFor="guest-name">Your name</label>
          <input id="guest-name" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoFocus />
          <span className="hint">Use the name your teammates call you.</span>
        </div>
        {failure && (
          <p className="form-error" role="alert">
            {failure}
          </p>
        )}
        <button type="submit" className="btn btn-primary btn-block" disabled={busy || !name.trim()}>
          {busy ? "One moment…" : "Continue"}
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => setGuest(false)}>
          Back to the list
        </button>
      </form>
    );
  }

  return (
    <div className="stack">
      <div className="input-prefix">
        <span>
          <Icon name="search" />
        </span>
        <input
          className="input"
          type="search"
          placeholder="Find your name"
          aria-label="Find your name"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      {failure && (
        <p className="form-error" role="alert">
          {failure}
        </p>
      )}
      <ul className="pick-list">
        {shown.map((p) => (
          <li key={p.id}>
            <button type="button" className="pick" disabled={busy} onClick={() => onPick(p)}>
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
    </div>
  );
}
