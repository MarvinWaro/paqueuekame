import { useState } from "react";
import { courtOrder } from "../../shared/sideout";
import type { MatchView, Player, UmpireState } from "../../shared/types";
import { BrandMark } from "../components/Brand";
import { CourtDiagram } from "../components/Court";
import { Icon } from "../components/Icon";
import { Sheet } from "../components/Sheet";
import { ThemeToggle } from "../components/ThemeToggle";
import { useToast } from "../components/Toast";
import { api, errorMessage } from "../lib/api";
import { useCourtColors } from "../lib/courtTheme";
import { names } from "../lib/format";
import { useApi } from "../lib/useApi";
import { Loading } from "../components/Loading";

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
  if (!state) return <main className="auth"><Loading label="Loading the courts…" /></main>;

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

/** Before scoring: coin toss (who serves first) and each team's base player. Or take over from another umpire. */
function StartScoring({ match, busy, post }: { match: MatchView; busy: boolean; post: Post }) {
  const live = match.live;
  const path = `/matches/${match.id}/start`;
  const [serving, setServing] = useState<1 | 2 | null>(null);
  const [base, setBase] = useState<Record<1 | 2, string | undefined>>({ 1: match.team1[0]?.id, 2: match.team2[0]?.id });

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
        <button
          type="button"
          className="btn btn-primary btn-block"
          disabled={busy}
          onClick={() => post(path, { firstServer: live.serving, base1: live.right1, base2: live.right2, force: true })}
        >
          {live.umpire ? "Take over scoring" : "Continue scoring"}
        </button>
      </div>
    );
  }

  const teamOf = (p: Player): 1 | 2 => (match.team1.some((x) => x.id === p.id) ? 1 : 2);
  const placed = courtOrder(match.team1, match.team2, base[1] ?? null, base[2] ?? null);
  const all = [...match.team1, ...match.team2];
  const firstServer = serving ? all.find((p) => p.id === base[serving]) : undefined;
  const baseNames = [base[1], base[2]].map((id) => all.find((p) => p.id === id)?.name).filter(Boolean);

  return (
    <div className="panel stack">
      <div className="ump-step">
        <span className="ump-step-no">1</span>
        <span>
          <b>Who serves first?</b>
          <span className="muted small">Coin toss or rally for serve.</span>
        </span>
      </div>
      <div className="ump-rally ump-choice">
        {([1, 2] as const).map((team) => (
          <button key={team} type="button" className="btn" aria-pressed={serving === team} onClick={() => setServing(team)}>
            {serving === team && <Icon name="check" />}
            {names(team === 1 ? match.team1 : match.team2)}
          </button>
        ))}
      </div>

      <div className="ump-step">
        <span className="ump-step-no">2</span>
        <span>
          <b>Base players</b>
          <span className="muted small">They start on the right side. Tap a name to move them there.</span>
        </span>
      </div>
      <CourtDiagram
        team1={placed.team1}
        team2={placed.team2}
        serverId={firstServer?.id ?? null}
        onPlayer={(p) => setBase((b) => ({ ...b, [teamOf(p)]: p.id }))}
        playerLabel={(p) => `Make ${p.name} the base player`}
      />
      <p className="small">
        {firstServer ? (
          <>
            <b>{firstServer.name}</b> serves first from the right: <b className="num">0-0-2</b>.
          </>
        ) : (
          <span className="muted">Base players: {baseNames.join(" and ")}. Pick who serves first to see the first server.</span>
        )}
      </p>
      <button
        type="button"
        className="btn btn-primary btn-block"
        disabled={busy || !serving}
        onClick={() => post(path, { firstServer: serving, base1: base[1], base2: base[2] }, "Game on")}
      >
        Start game
      </button>
      <p className="muted small">Traditional side-out scoring: game to 11, win by 2.</p>
    </div>
  );
}

function ScoreBoard({ match, busy, post }: { match: MatchView; busy: boolean; post: Post }) {
  const live = match.live!;
  const [pick, setPick] = useState<Player | null>(null);
  const all = [...match.team1, ...match.team2];
  const server = all.find((p) => p.id === live.serverId);
  const winners = live.winner === 1 ? match.team1 : live.winner === 2 ? match.team2 : null;
  const placed = courtOrder(match.team1, match.team2, live.right1, live.right2);
  const teamOf = (p: Player): 1 | 2 => (match.team1.some((x) => x.id === p.id) ? 1 : 2);

  const rally = (team: 1 | 2) => {
    navigator.vibrate?.(15);
    void post(`/matches/${match.id}/rally`, { seq: live.events, winner: team });
  };
  const undo = () => post(`/matches/${match.id}/undo`, { seq: live.events - 1 }, "Last step undone");
  const correct = async (body: { kind: "server"; playerId: string; serverNo: 1 | 2 } | { kind: "swap"; team: 1 | 2 }, done: string) => {
    if (await post(`/matches/${match.id}/correct`, { seq: live.events, ...body }, done)) setPick(null);
  };
  // The call this player would make as 1st or 2nd server: their team's score first.
  const callFor = (p: Player, n: 1 | 2) => {
    const t = teamOf(p);
    return `${t === 1 ? live.score1 : live.score2}-${t === 1 ? live.score2 : live.score1}-${n}`;
  };

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
      {!winners && (
        <p className="muted small" style={{ margin: 0 }}>
          Screen doesn't match the court? Tap a name to change the server, or swap a team's sides.
        </p>
      )}
      <CourtDiagram
        team1={placed.team1}
        team2={placed.team2}
        serverId={winners ? null : live.serverId}
        winner={live.winner}
        onPlayer={winners ? undefined : setPick}
        playerLabel={(p) => `Make ${p.name} the server`}
      />
      {!winners && (
        <div className="ump-swaps">
          {([1, 2] as const).map((team) => (
            <button
              key={team}
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={busy}
              onClick={() => correct({ kind: "swap", team }, `${names(team === 1 ? match.team1 : match.team2)} swapped sides`)}
            >
              <Icon name="swap" /> Swap sides
            </button>
          ))}
        </div>
      )}

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
            <Icon name="undo" /> Undo last step
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
          <button type="button" className="btn btn-ghost" disabled={busy || live.events === 0} onClick={undo}>
            <Icon name="undo" /> Undo last step
          </button>
        </>
      )}

      {pick && (
        <Sheet title={`Make ${pick.name} the server?`} onClose={() => setPick(null)}>
          <p className="muted">For when the screen doesn't match the court. It's saved as a correction, and Undo removes it.</p>
          <div className="ump-rally ump-server-pick">
            {([1, 2] as const).map((n) => (
              <button
                key={n}
                type="button"
                className={live.serverId === pick.id && live.server === n ? "btn btn-primary" : "btn"}
                disabled={busy}
                onClick={() => correct({ kind: "server", playerId: pick.id, serverNo: n }, `${pick.name} is serving`)}
              >
                <span>{n === 1 ? "1st server" : "2nd server"}</span>
                <b className="num">{callFor(pick, n)}</b>
              </button>
            ))}
          </div>
        </Sheet>
      )}
    </div>
  );
}
