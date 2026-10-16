import { type FormEvent, useState } from "react";
import type { Me } from "../../shared/types";
import { Brand } from "../components/Brand";
import { ThemeToggle } from "../components/ThemeToggle";
import { api, errorMessage } from "../lib/api";
import { slugify } from "../lib/format";
import { Link, navigate } from "../lib/router";

export function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/auth/login", { method: "POST", body: { email, password } });
      navigate("/app", { replace: true });
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <main className="auth">
      <div className="auth-card">
        <div className="row spread">
          <Brand />
          <ThemeToggle />
        </div>
        <div>
          <h1>Log in</h1>
          <p className="muted" style={{ marginTop: 8 }}>
            For organizers. Players don't need an account.
          </p>
        </div>
        <form className="panel stack" onSubmit={submit} noValidate>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              className="input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
            {busy ? "Logging in…" : "Log in"}
          </button>
        </form>
        <p className="muted">
          New team? <Link to="/register">Create your team</Link>
        </p>
      </div>
    </main>
  );
}

export function Register() {
  const [teamName, setTeamName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api<Me>("/api/auth/register", { method: "POST", body: { teamName, slug: slug || slugify(teamName), name, email, password } });
      navigate("/app/players", { replace: true });
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <main className="auth">
      <div className="auth-card">
        <div className="row spread">
          <Brand />
          <ThemeToggle />
        </div>
        <div>
          <h1>Create your team</h1>
          <p className="muted" style={{ marginTop: 8 }}>
            Free. You'll add your players next, then start your first session.
          </p>
        </div>
        <form className="panel stack" onSubmit={submit} noValidate>
          <div className="field">
            <label htmlFor="teamName">Team name</label>
            <input
              id="teamName"
              className="input"
              value={teamName}
              onChange={(e) => {
                setTeamName(e.target.value);
                if (!slugEdited) setSlug(slugify(e.target.value));
              }}
              placeholder="Dink Dynasty"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="slug">Team link</label>
            <div className="input-prefix">
              <span>paqueuekame/</span>
              <input
                id="slug"
                className="input"
                value={slug}
                onChange={(e) => {
                  setSlugEdited(true);
                  setSlug(slugify(e.target.value));
                }}
                required
              />
            </div>
            <span className="hint">Letters, numbers and dashes. You can't change it later.</span>
          </div>
          <div className="field">
            <label htmlFor="name">Your name</label>
            <input id="name" className="input" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              className="input"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <span className="hint">At least 8 characters.</span>
          </div>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
            {busy ? "Creating…" : "Create team"}
          </button>
        </form>
        <p className="muted">
          Already have a team? <Link to="/login">Log in</Link>
        </p>
      </div>
    </main>
  );
}
