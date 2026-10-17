import { useState } from "react";
import type { MatchView, UmpireState } from "../../shared/types";
import { BrandMark } from "../components/Brand";
import { CourtDiagram } from "../components/Court";
import { Icon } from "../components/Icon";
import { ThemeToggle } from "../components/ThemeToggle";
import { useToast } from "../components/Toast";
import { api, errorMessage } from "../lib/api";
import { useCourtColors } from "../lib/courtTheme";
import { names } from "../lib/format";
import { useApi } from "../lib/useApi";

type Post = (path: string, body?: unknown, done?: string) => Promise<boolean>;

/** Opened from an umpire link: pick a court, then score it rally by rally. No queue controls. */
export function Umpire({ token }: { token: string }) {
  const { data: state, setData, error } = useApi<UmpireState>(`/api/ump/${token}`, { pollMs: 5000 });
  const [court, setCourt] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  useCourtColors(state?.courtColors);

  const post: Post = async (path, body, done) => {
    setBusy(true);
    try {
      setData(await api<UmpireState>(`/api/ump/${token}${path}`, { method: "POST", body }));
      if (done) toast(done);
      return true;
    } catch (err) {
      toast(errorMessage(err));
      return false;
    } finally {
      setBusy(false);
    }
  };

  if (error && !state) {
    return (
      <main className="auth">
        <div className="auth-card">
          <div className="panel empty">
            <h1>Can't open the umpire page</h1>
            <p className="muted">{error}</p>
          </div>
        </div>
      </main>
    );
  }
  if (!state) return <main className="auth muted">Loading the courts…</main>;

  return (
    <>
      <header className="topbar">
        <div className="wrap topbar-inner">
          <span className="brand">
            <BrandMark />
            <span>{state.teamName}</span>
          </span>
          <ThemeToggle />
        </div>
      </header>
      <main className="wrap page">
        <header className="session-head">
          <span className="row">
            <span className="pill">Umpire</span>
            <span className="muted">{state.umpire.name}</span>
          </span>
          <h1>{state.sessionTitle}</h1>
        </header>
        {state.status === "ended" ? (
          <div className="panel empty">
            <p className="muted">This session has ended. Thanks for umpiring!</p>
          </div>
        ) : court === null ? (
          <CourtList state={state} onPick={setCourt} />
        ) : (
          <Scoring state={state} court={court} busy={busy} post={post} onBack={() => setCourt(null)} />
        )}
      </main>
    </>
  );
}

function CourtList({ state, onPick }: { state: UmpireState; onPick: (court: number) => void }) {
  const playing = state.courts.filter((c) => c.match);
  return (
    <section className="stack">
      <h2>Pick a court to score</h2>
      {playing.length === 0 ? (
        <div className="panel empty">
          <p className="muted">No games on court right now. This page updates by itself.</p>
        </div>
      ) : (
        <ul className="pick-list">
          {playing.map(({ court, match }) => {
            const live = match!.live;
            const other = live?.umpireId && live.umpireId !== state.umpire.id ? live.umpire : null;
            return (
              <li key={court}>
                <button type="button" className="pick" onClick={() => onPick(court)}>
                  <span>
                    <span style={{ display: "block", fontWeight: 750 }}>Court {court}</span>
                    <span className="muted small">
                      {names(match!.team1)} vs {names(match!.team2)}
                    </span>
                  </span>
                  <span className="small" style={{ textAlign: "right" }}>
                    {live ? (
                      <b className="num">
                        {live.score1}–{live.score2}
                      </b>
                    ) : (
                      "Not started"
                    )}
                    {other && (
                      <>
                        <br />
                        <span className="muted">Umpire: {other}</span>
                      </>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function Scoring({ state, court, busy, post, onBack }: { state: UmpireState; court: number; busy: boolean; post: Post; onBack: () => void }) {
  const match = state.courts.find((c) => c.court === court)?.match ?? null;
  return (
    <section className="stack">
      <button type="button" className="btn btn-ghost btn-sm back-btn" onClick={onBack}>
        <Icon name="back" /> Courts
      </button>
      <h2>Court {court}</h2>
      {!match ? (
        <div className="panel empty">
          <p className="muted">Court {court} is free. The next game shows up here when the organizer starts it.</p>
        </div>
      ) : match.live?.umpireId === state.umpire.id ? (
        <ScoreBoard match={match} busy={busy} post={post} />
      ) : (
        <StartScoring match={match} busy={busy} post={post} />
      )}
    </section>
  );
}

/** Before scoring: who serves first, or take over from another umpire. */
function StartScoring({ match, busy, post }: { match: MatchView; busy: boolean; post: Post }) {
  const live = match.live;
  const path = `/matches/${match.id}/start`;
  if (live) {
    // Someone already scored part of this game: keep their score and carry on.
    return (
      <div className="panel stack">
        <p>
          {live.umpire ? `${live.umpire} is scoring this game` : "This game was being scored"}, at{" "}
          <b className="num">
            {live.score1}–{live.score2}
          </b>
          .
        </p>
        <button type="button" className="btn btn-primary btn-block" disabled={busy} onClick={() => post(path, { firstServer: live.serving, force: true })}>
          {live.umpire ? "Take over scoring" : "Continue scoring"}
        </button>
      </div>
    );
  }
  return (
    <div className="panel stack">
      <CourtDiagram team1={match.team1} team2={match.team2} />
      <p style={{ fontWeight: 650 }}>Who serves first?</p>
      <div className="ump-rally">
        {([1, 2] as const).map((team) => (
          <button key={team} type="button" className="btn" disabled={busy} onClick={() => post(path, { firstServer: team }, "Scoring started")}>
            {names(team === 1 ? match.team1 : match.team2)}
          </button>
        ))}
      </div>
      <p className="muted small">Traditional side-out scoring: game to 11, win by 2. The first serving team starts at 0-0-2.</p>
    </div>
  );
}

function ScoreBoard({ match, busy, post }: { match: MatchView; busy: boolean; post: Post }) {
  const live = match.live!;
  const server = [...match.team1, ...match.team2].find((p) => p.id === live.serverId);
  const winners = live.winner === 1 ? match.team1 : live.winner === 2 ? match.team2 : null;
  const rally = (team: 1 | 2) => {
    navigator.vibrate?.(15);
    void post(`/matches/${match.id}/rally`, { seq: live.rallies, winner: team });
  };
  const undo = () => post(`/matches/${match.id}/undo`, { seq: live.rallies - 1 }, "Last rally undone");

  return (
    <div className="stack">
      <div className="ump-call" aria-live="polite">
        <b className="num">{live.call}</b>
        <span className="muted">
          {winners ? "Game over" : `${server?.name ?? "Server"} serving, ${live.server === 1 ? "first" : "second"} server`}
        </span>
      </div>
      <div className="ump-score">
        <span className={live.serving === 1 && !winners ? "is-serving" : ""}>
          {names(match.team1)} <b className="num">{live.score1}</b>
        </span>
        <span className={live.serving === 2 && !winners ? "is-serving" : ""}>
          {names(match.team2)} <b className="num">{live.score2}</b>
        </span>
      </div>
      <CourtDiagram team1={match.team1} team2={match.team2} serverId={winners ? null : live.serverId} winner={live.winner} />

      {winners ? (
        <div className="panel stack">
          <p className="you-status">
            {names(winners)} win {Math.max(live.score1, live.score2)}–{Math.min(live.score1, live.score2)}
          </p>
          <button
            type="button"
            className="btn btn-primary btn-block"
            disabled={busy}
            onClick={() => post(`/matches/${match.id}/finish`, undefined, `Result saved. Court ${match.court} is free.`)}
          >
            Save result
          </button>
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={undo}>
            <Icon name="undo" /> Undo last rally
          </button>
        </div>
      ) : (
        <>
          <p className="muted small" style={{ margin: 0 }}>
            Who won the rally?
          </p>
          <div className="ump-rally">
            {([1, 2] as const).map((team) => (
              <button key={team} type="button" className="btn btn-primary" disabled={busy} onClick={() => rally(team)}>
                {names(team === 1 ? match.team1 : match.team2)}
              </button>
            ))}
          </div>
          <button type="button" className="btn btn-ghost" disabled={busy || live.rallies === 0} onClick={undo}>
            <Icon name="undo" /> Undo last rally
          </button>
        </>
      )}
    </div>
  );
}
