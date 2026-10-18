import { type FormEvent, useMemo, useState } from "react";
import type { RosterPlayer } from "../../../shared/types";
import { Icon } from "../../components/Icon";
import { Sheet } from "../../components/Sheet";
import { Skill, SkillPicker, skillLabel } from "../../components/Skill";
import { useToast } from "../../components/Toast";
import { api, errorMessage } from "../../lib/api";
import { plural } from "../../lib/format";
import { useApi } from "../../lib/useApi";

export function Players() {
  const { data: players, setData, error, reload } = useApi<RosterPlayer[]>("/api/players");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<RosterPlayer | null>(null);
  const [pasting, setPasting] = useState(false);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (players ?? []).filter((p) => !q || p.name.toLowerCase().includes(q));
  }, [players, query]);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Players</h1>
          <p className="muted">
            {players ? plural(players.filter((p) => !p.isGuest).length, "member") : "Your team roster"}
            {players && players.some((p) => p.isGuest) ? `, ${plural(players.filter((p) => p.isGuest).length, "guest")}` : ""}
          </p>
        </div>
        <button type="button" className="btn" onClick={() => setPasting(true)}>
          Paste a list
        </button>
      </div>

      <AddPlayer onAdded={(p) => setData((list) => [...(list ?? []), p].sort((a, b) => a.name.localeCompare(b.name)))} />

      {error && <p className="form-error">{error}</p>}
      {players && players.length > 0 && (
        <section className="stack">
          <div className="input-prefix">
            <span>
              <Icon name="search" />
            </span>
            <input className="input" type="search" placeholder="Find a player" aria-label="Find a player" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <ul className="pick-list">
            {shown.map((p) => (
              <li key={p.id}>
                <button type="button" className="pick" onClick={() => setEditing(p)}>
                  <span className="row" style={{ minWidth: 0 }}>
                    <span>{p.name}</span>
                    {p.isGuest && <span className="pill pill-guest">Guest</span>}
                    <Skill value={p.skill} />
                  </span>
                  <span className="muted small num" title="Across all sessions">
                    {plural(p.games, "game")} · {plural(p.sessions, "session")}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {shown.length === 0 && <p className="muted">No one matches “{query}”.</p>}
        </section>
      )}
      {players && players.length === 0 && (
        <div className="panel empty">
          <h2>Add your team</h2>
          <p className="muted">Type names above, or paste the list from your group chat. Skill levels are optional; they help balance teams.</p>
        </div>
      )}

      {editing && (
        <EditPlayer
          player={editing}
          onClose={() => setEditing(null)}
          onSaved={(p) => {
            setData((list) => (list ?? []).map((x) => (x.id === p.id ? p : x)));
            setEditing(null);
          }}
          onRemoved={(id) => {
            setData((list) => (list ?? []).filter((x) => x.id !== id));
            setEditing(null);
          }}
        />
      )}
      {pasting && (
        <PasteList
          roster={players ?? []}
          onClose={() => setPasting(false)}
          onDone={() => {
            setPasting(false);
            reload();
          }}
        />
      )}
    </div>
  );
}

function AddPlayer({ onAdded }: { onAdded: (p: RosterPlayer) => void }) {
  const [name, setName] = useState("");
  const [skill, setSkill] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const p = await api<RosterPlayer>("/api/players", { method: "POST", body: { name, skill } });
      onAdded(p);
      toast(`Added ${p.name}`);
      setName("");
      setSkill(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="panel stack" onSubmit={submit} noValidate>
      <div className="roster-add">
        <div className="field">
          <label htmlFor="new-name">Add a player</label>
          <input id="new-name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name or nickname" />
        </div>
        <button className="btn btn-primary" type="submit" disabled={busy || !name.trim()}>
          Add player
        </button>
      </div>
      <div className="field">
        <span style={{ fontWeight: 650, fontSize: "0.9375rem" }}>Skill level</span>
        <SkillPicker value={skill} onChange={setSkill} />
        <span className="hint">{skill ? skillLabel(skill) : "Optional. 1 is beginner, 6 is expert."}</span>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}

function EditPlayer({
  player,
  onClose,
  onSaved,
  onRemoved,
}: {
  player: RosterPlayer;
  onClose: () => void;
  onSaved: (p: RosterPlayer) => void;
  onRemoved: (id: string) => void;
}) {
  const [name, setName] = useState(player.name);
  const [skill, setSkill] = useState<number | null>(player.skill);
  const [isGuest, setIsGuest] = useState(player.isGuest);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      onSaved(await api<RosterPlayer>(`/api/players/${player.id}`, { method: "PATCH", body: { name, skill, isGuest } }));
      toast("Saved");
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/players/${player.id}`, { method: "DELETE" });
      onRemoved(player.id);
      toast(`Removed ${player.name}`);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <Sheet title={player.name} onClose={onClose}>
      <form className="stack" onSubmit={save} noValidate>
        <div className="field">
          <label htmlFor="edit-name">Name</label>
          <input id="edit-name" className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <span style={{ fontWeight: 650, fontSize: "0.9375rem" }}>Skill level</span>
          <SkillPicker value={skill} onChange={setSkill} />
          <span className="hint">{skillLabel(skill)}</span>
        </div>
        <label className="switch">
          <span>
            <span style={{ display: "block", fontWeight: 650 }}>Guest</span>
            <span className="muted small">Not a regular member of the team.</span>
          </span>
          <input type="checkbox" checked={isGuest} onChange={(e) => setIsGuest(e.target.checked)} />
        </label>
        <p className="muted small">
          {plural(player.sessions, "session")}, {plural(player.games, "game")} played
        </p>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
          Save changes
        </button>
        {confirmRemove ? (
          <div className="stack" style={{ gap: 8 }}>
            <p className="small">Remove {player.name} from the roster? Their past games stay in history.</p>
            <div className="row">
              <button type="button" className="btn btn-danger-solid" onClick={remove} disabled={busy}>
                Remove {player.name}
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setConfirmRemove(false)}>
                Keep
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="btn btn-ghost btn-danger" onClick={() => setConfirmRemove(true)}>
            Remove from roster
          </button>
        )}
      </form>
    </Sheet>
  );
}

interface Draft {
  key: number;
  name: string;
  skill: number | null;
  on: boolean; // ticked: will be added
}

/** Paste a list from the group chat, then review it: fix names, set skill levels, skip duplicates. */
function PasteList({ roster, onClose, onDone }: { roster: RosterPlayer[]; onClose: () => void; onDone: () => void }) {
  const [text, setText] = useState("");
  const [drafts, setDrafts] = useState<Draft[] | null>(null); // null = still on the paste step
  const [open, setOpen] = useState<number | null>(null); // which row's skill picker is showing
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const onRoster = useMemo(() => new Set(roster.map((p) => p.name.toLowerCase())), [roster]);

  // Accept "1. Juan", "- Ana", "Mark ✅" style lines from a group chat; drop repeats.
  const names = [
    ...new Map(
      text
        .split(/\r?\n|,/)
        .map((line) => line.replace(/^\s*(\d+[.)]|[-*•])\s*/, "").replace(/[^\p{L}\p{N} .'-]/gu, "").trim().slice(0, 40))
        .filter(Boolean)
        .map((n) => [n.toLowerCase(), n] as const),
    ).values(),
  ];

  const review = () => {
    setDrafts(names.map((name, key) => ({ key, name, skill: null, on: !onRoster.has(name.toLowerCase()) })));
    setOpen(null);
  };
  const update = (key: number, change: Partial<Draft>) =>
    setDrafts((list) => list!.map((d) => (d.key === key ? { ...d, ...change } : d)));

  if (!drafts) {
    return (
      <Sheet title="Paste a list" onClose={onClose}>
        <div className="field">
          <label htmlFor="paste">One name per line</label>
          <textarea
            id="paste"
            className="input"
            rows={8}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={"1. Juan\n2. Ana\n3. Mark"}
          />
          <span className="hint">Numbers, bullets and emoji are removed. Next you can fix names and set skill levels.</span>
        </div>
        <button type="button" className="btn btn-primary btn-block" onClick={review} disabled={names.length === 0}>
          {names.length ? `Review ${plural(names.length, "name")}` : "Review names"}
        </button>
      </Sheet>
    );
  }

  const ticked = drafts.filter((d) => d.on && d.name.trim());
  const allTicked = drafts.every((d) => d.on || onRoster.has(d.name.trim().toLowerCase()));

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const players = ticked.map((d) => ({ name: d.name.trim(), skill: d.skill }));
      const res = await api<{ added: number; skipped: number }>("/api/players/bulk", { method: "POST", body: { players } });
      toast(res.skipped ? `Added ${res.added}. ${res.skipped} were already on the roster.` : `Added ${plural(res.added, "player")}`);
      onDone();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <Sheet title="Review players" onClose={onClose}>
      <div className="review-bar">
        <label className="tick-all">
          <input
            type="checkbox"
            checked={allTicked}
            onChange={(e) => setDrafts((list) => list!.map((d) => ({ ...d, on: e.target.checked && !onRoster.has(d.name.trim().toLowerCase()) })))}
          />
          <span>{plural(ticked.length, "player")} ticked</span>
        </label>
        <select
          className="input"
          aria-label="Set skill for ticked players"
          value=""
          onChange={(e) => {
            const v = e.target.value === "clear" ? null : Number(e.target.value);
            setDrafts((list) => list!.map((d) => (d.on ? { ...d, skill: v } : d)));
          }}
        >
          <option value="" disabled>
            Set skill for ticked…
          </option>
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <option key={n} value={n}>
              {n} · {skillLabel(n)}
            </option>
          ))}
          <option value="clear">Clear skill</option>
        </select>
      </div>

      <ul className="review-list">
        {drafts.map((d) => {
          const dupe = onRoster.has(d.name.trim().toLowerCase());
          return (
            <li key={d.key} className={`review-row ${d.on ? "" : "is-off"}`}>
              <div className="review-main">
                <label className="tick" aria-label={`Add ${d.name}`}>
                  <input type="checkbox" checked={d.on} onChange={(e) => update(d.key, { on: e.target.checked })} />
                </label>
                <input
                  className="input"
                  value={d.name}
                  maxLength={40}
                  aria-label="Name"
                  onChange={(e) => update(d.key, { name: e.target.value })}
                />
                <button
                  type="button"
                  className={`btn btn-sm skill-toggle ${d.skill ? "has-skill" : ""}`}
                  aria-expanded={open === d.key}
                  onClick={() => setOpen(open === d.key ? null : d.key)}
                >
                  {d.skill ? <Skill value={d.skill} plain /> : "Skill"}
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={`Remove ${d.name}`}
                  onClick={() => setDrafts((list) => list!.filter((x) => x.key !== d.key))}
                >
                  <Icon name="close" />
                </button>
              </div>
              {dupe && <span className="review-note">Already on the roster, so it will be skipped.</span>}
              {open === d.key && (
                <div className="review-skill">
                  <SkillPicker
                    value={d.skill}
                    onChange={(v) => {
                      update(d.key, { skill: v });
                      setOpen(null);
                    }}
                  />
                  <span className="hint">{skillLabel(d.skill)}</span>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <p className="muted small">They join the roster. Check them in from the session when they arrive.</p>
      <div className="row">
        <button type="button" className="btn btn-ghost" onClick={() => setDrafts(null)}>
          <Icon name="back" /> Back
        </button>
        <button type="button" className="btn btn-primary" style={{ flex: 1 }} onClick={submit} disabled={busy || ticked.length === 0}>
          {busy ? "Adding…" : `Add ${plural(ticked.length, "player")}`}
        </button>
      </div>
    </Sheet>
  );
}
