import { type CSSProperties, type FormEvent, useState } from "react";
import type { Me, Organizer, Team } from "../../../shared/types";
import {
  COURT_THEMES,
  COURT_THEME_KEYS,
  CUSTOM_THEME,
  type CourtColors,
  type CourtTheme,
  HEX_COLOR,
  courtColorProblem,
  courtColorsOf,
  courtThemeOf,
  courtVars,
  normalizeHex,
} from "../../../shared/courtThemes";
import { Icon } from "../../components/Icon";
import { useToast } from "../../components/Toast";
import { applyCourtColors } from "../../lib/courtTheme";
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
        {me && <CourtColorPicker me={me} onSaved={(team) => setMe({ ...me, team })} />}
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

function CourtColorPicker({ me, onSaved }: { me: Me; onSaved: (team: Team) => void }) {
  const { courtTheme, customColors } = me.team;
  const current = courtTheme === CUSTOM_THEME && customColors ? CUSTOM_THEME : courtThemeOf(courtTheme);
  const saved = courtColorsOf(courtTheme, customColors);
  const [editing, setEditing] = useState(current === CUSTOM_THEME);
  const [draft, setDraft] = useState<CourtColors>(customColors ?? saved);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  const next = { court: normalizeHex(draft.court), kitchen: normalizeHex(draft.kitchen) };
  const problems = { court: courtColorProblem("court", next.court), kitchen: courtColorProblem("kitchen", next.kitchen) };
  const preview = {
    court: HEX_COLOR.test(next.court) ? next.court : saved.court,
    kitchen: HEX_COLOR.test(next.kitchen) ? next.kitchen : saved.kitchen,
  };
  const unchanged =
    current === CUSTOM_THEME && next.court === customColors?.court && next.kitchen === customColors?.kitchen;

  const save = async (body: { courtTheme: string; customColors?: CourtColors }, done: string) => {
    applyCourtColors(courtColorsOf(body.courtTheme, body.customColors ?? customColors)); // show it right away
    setError(null);
    try {
      onSaved(await api<Team>("/api/team", { method: "PATCH", body }));
      toast(done);
    } catch (err) {
      applyCourtColors(saved);
      setError(errorMessage(err));
    }
  };

  const pickPreset = (key: CourtTheme) => {
    setEditing(false);
    if (key !== current) save({ courtTheme: key }, `Courts are now ${COURT_THEMES[key].label.toLowerCase()}`);
  };

  const pickCustom = () => {
    setEditing(true);
    if (current !== CUSTOM_THEME && customColors) save({ courtTheme: CUSTOM_THEME }, "Courts are back to your colors");
  };

  const saveCustom = (e: FormEvent) => {
    e.preventDefault();
    if (problems.court || problems.kitchen || unchanged) return;
    save({ courtTheme: CUSTOM_THEME, customColors: next }, "Courts now use your colors");
  };

  const cancel = () => {
    setEditing(false);
    setDraft(customColors ?? saved);
    setError(null);
  };

  return (
    <section className="panel stack">
      <div>
        <h2>Court colors</h2>
        <p className="muted" style={{ marginTop: 6 }}>
          Match the courts you play on. Your players see these colors on the live link too.
        </p>
      </div>
      <div className="swatches" role="group" aria-label="Court colors">
        {COURT_THEME_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            className="swatch"
            aria-pressed={key === current}
            onClick={() => pickPreset(key)}
            style={swatchStyle(COURT_THEMES[key])}
          >
            <SwatchDiagram />
            <span className="swatch-label">
              {key === current && <Icon name="check" />}
              {COURT_THEMES[key].label}
            </span>
          </button>
        ))}
        <button
          type="button"
          className="swatch"
          aria-pressed={current === CUSTOM_THEME}
          aria-expanded={editing}
          onClick={pickCustom}
          style={swatchStyle(preview)}
        >
          <SwatchDiagram />
          <span className="swatch-label">
            {current === CUSTOM_THEME && <Icon name="check" />}
            Custom
          </span>
        </button>
      </div>
      {editing && (
        <form className="stack" onSubmit={saveCustom} noValidate>
          <ColorField
            area="court"
            label="Court"
            hint="The playing area outside the kitchen."
            value={draft.court}
            problem={problems.court}
            onChange={(court) => setDraft({ ...draft, court })}
          />
          <ColorField
            area="kitchen"
            label="Kitchen"
            hint="The no-volley zone on both sides of the net."
            value={draft.kitchen}
            problem={problems.kitchen}
            onChange={(kitchen) => setDraft({ ...draft, kitchen })}
          />
          <div className="row row-wrap">
            <button className="btn btn-primary" type="submit" disabled={!!problems.court || !!problems.kitchen || unchanged}>
              Use these colors
            </button>
            {current !== CUSTOM_THEME && (
              <button type="button" className="btn btn-ghost" onClick={cancel}>
                Cancel
              </button>
            )}
          </div>
        </form>
      )}
      {error && <p className="form-error">{error}</p>}
    </section>
  );
}

const swatchStyle = (c: CourtColors) => courtVars(c) as CSSProperties;

function SwatchDiagram() {
  return (
    <span className="diagram" aria-hidden="true">
      <span className="half half-left">
        <span className="box" />
        <span className="box" />
      </span>
      <span className="kitchen" />
      <span className="net" />
      <span className="kitchen" />
      <span className="half half-right">
        <span className="box" />
        <span className="box" />
      </span>
    </span>
  );
}

function ColorField(props: {
  area: keyof CourtColors;
  label: string;
  hint: string;
  value: string;
  problem: string | null;
  onChange: (value: string) => void;
}) {
  const { area, label, hint, value, problem, onChange } = props;
  const id = `custom-${area}`;
  const hex = normalizeHex(value);
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <span className="hint" id={`${id}-hint`}>
        {hint}
      </span>
      <div className="color-field">
        <input
          type="color"
          className="color-input"
          aria-label={`Pick the ${area} color`}
          value={HEX_COLOR.test(hex) ? hex : "#000000"}
          onChange={(e) => onChange(e.target.value)}
        />
        <input
          id={id}
          className={problem ? "input input-invalid" : "input"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={7}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          aria-invalid={!!problem}
          aria-describedby={problem ? `${id}-error` : `${id}-hint`}
        />
      </div>
      {problem && (
        <p className="form-error" id={`${id}-error`}>
          {problem}
        </p>
      )}
    </div>
  );
}
