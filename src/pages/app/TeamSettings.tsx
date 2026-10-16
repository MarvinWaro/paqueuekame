import { type FormEvent, useState } from "react";
import type { Me, Organizer } from "../../../shared/types";
import { useToast } from "../../components/Toast";
import { api, errorMessage } from "../../lib/api";
import { useApi } from "../../lib/useApi";

export function TeamSettings() {
  const { data: me, setData: setMe } = useApi<Me>("/api/me");
  const { data: organizers, setData: setOrganizers } = useApi<Organizer[]>("/api/organizers");

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Team</h1>
          <p className="muted">Your team name, organizers and password.</p>
        </div>
      </div>
      <div className="two-col">
        {me && <TeamName me={me} onSaved={(name) => setMe({ ...me, team: { ...me.team, name } })} />}
        <section className="panel stack">
          <h2>Organizers</h2>
          <p className="muted">Organizers can run sessions and edit the roster. Players never need an account.</p>
          <ul className="pick-list">
            {organizers?.map((o) => (
              <li key={o.id} className="pick" style={{ cursor: "default" }}>
                <span>
                  <span style={{ display: "block" }}>
                    {o.name}
                    {o.id === me?.organizer.id ? " (you)" : ""}
                  </span>
                  <span className="muted small">{o.email}</span>
                </span>
                {o.id !== me?.organizer.id && <RemoveOrganizer organizer={o} onRemoved={() => setOrganizers((list) => (list ?? []).filter((x) => x.id !== o.id))} />}
              </li>
            ))}
          </ul>
          <AddOrganizer onAdded={(o) => setOrganizers((list) => [...(list ?? []), o])} />
        </section>
        <ChangePassword />
      </div>
    </div>
  );
}

function TeamName({ me, onSaved }: { me: Me; onSaved: (name: string) => void }) {
  const [name, setName] = useState(me.team.name);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();
  const save = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api("/api/team", { method: "PATCH", body: { name } });
      onSaved(name);
      toast("Team name saved");
    } catch (err) {
      setError(errorMessage(err));
    }
  };
  return (
    <form className="panel stack" onSubmit={save}>
      <h2>Team name</h2>
      <div className="field">
        <label htmlFor="team-name">Name players see on the live board</label>
        <input id="team-name" className="input" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      {error && <p className="form-error">{error}</p>}
      <button className="btn btn-primary" type="submit" disabled={name.trim() === me.team.name}>
        Save name
      </button>
    </form>
  );
}

function AddOrganizer({ onAdded }: { onAdded: (o: Organizer) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();
  if (!open) {
    return (
      <button type="button" className="btn" onClick={() => setOpen(true)}>
        Add an organizer
      </button>
    );
  }
  const save = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      onAdded(await api<Organizer>("/api/organizers", { method: "POST", body: { name, email, password } }));
      toast(`${name} can now log in`);
      setOpen(false);
      setName("");
      setEmail("");
      setPassword("");
    } catch (err) {
      setError(errorMessage(err));
    }
  };
  return (
    <form className="stack" onSubmit={save} noValidate>
      <div className="field">
        <label htmlFor="o-name">Name</label>
        <input id="o-name" className="input" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="o-email">Email</label>
        <input id="o-email" className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="o-pass">Temporary password</label>
        <input id="o-pass" className="input" type="text" autoComplete="off" value={password} onChange={(e) => setPassword(e.target.value)} />
        <span className="hint">At least 8 characters. Send it to them privately; they can change it after logging in.</span>
      </div>
      {error && <p className="form-error">{error}</p>}
      <div className="row">
        <button className="btn btn-primary" type="submit">
          Add organizer
        </button>
        <button className="btn btn-ghost" type="button" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function RemoveOrganizer({ organizer, onRemoved }: { organizer: Organizer; onRemoved: () => void }) {
  const [confirm, setConfirm] = useState(false);
  const toast = useToast();
  if (!confirm) {
    return (
      <button type="button" className="btn btn-ghost btn-sm btn-danger" onClick={() => setConfirm(true)}>
        Remove
      </button>
    );
  }
  return (
    <button
      type="button"
      className="btn btn-sm btn-danger-solid"
      onClick={async () => {
        try {
          await api(`/api/organizers/${organizer.id}`, { method: "DELETE" });
          onRemoved();
          toast(`${organizer.name} removed`);
        } catch (err) {
          toast(errorMessage(err));
        }
      }}
    >
      Remove {organizer.name}
    </button>
  );
}

function ChangePassword() {
  const [currentPassword, setCurrent] = useState("");
  const [newPassword, setNew] = useState("");
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();
  const save = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api("/api/me/password", { method: "POST", body: { currentPassword, newPassword } });
      toast("Password changed");
      setCurrent("");
      setNew("");
    } catch (err) {
      setError(errorMessage(err));
    }
  };
  return (
    <form className="panel stack" onSubmit={save} noValidate>
      <h2>Your password</h2>
      <div className="field">
        <label htmlFor="cur">Current password</label>
        <input id="cur" className="input" type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrent(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="new">New password</label>
        <input id="new" className="input" type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNew(e.target.value)} />
        <span className="hint">At least 8 characters.</span>
      </div>
      {error && <p className="form-error">{error}</p>}
      <button className="btn btn-primary" type="submit" disabled={!currentPassword || !newPassword}>
        Change password
      </button>
    </form>
  );
}
