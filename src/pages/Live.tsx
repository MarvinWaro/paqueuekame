import { useEffect, useMemo, useRef, useState } from "react";
import type { CheckinRoster, SessionState } from "../../shared/types";
import { BrandMark } from "../components/Brand";
import { CourtCard } from "../components/Court";
import { Icon } from "../components/Icon";
import { NamePicker } from "../components/NamePicker";
import { Sheet } from "../components/Sheet";
import { ThemeToggle } from "../components/ThemeToggle";
import { useToast } from "../components/Toast";
import { api, errorMessage } from "../lib/api";
import { useCourtColors } from "../lib/courtTheme";
import { minutes, ordinal, plural } from "../lib/format";
import { codeKey, meKey, readItem, removeItem, writeItem } from "../lib/storage";
import { useApi, useNow } from "../lib/useApi";
import { GameLog, Podium, SessionSummary, Standings } from "./Results";

type Mine =
  | { kind: "unknown" }
  | { kind: "playing"; court: number }
  | { kind: "next" }
  | { kind: "line"; position: number; est: number }
  | { kind: "coming" }
  | { kind: "break" }
  | { kind: "left" }
  | { kind: "out" };

function whereAmI(state: SessionState, me: string | null): Mine {
  if (!me) return { kind: "unknown" };
  const court = state.courts.find((c) => c.match && [...c.match.team1, ...c.match.team2].some((p) => p.id === me));
  if (court) return { kind: "playing", court: court.court };
  if (state.next && [...state.next.team1, ...state.next.team2].some((p) => p.id === me)) return { kind: "next" };
  const q = state.queue.find((x) => x.player.id === me);
  if (q) return { kind: "line", position: q.position, est: q.estMinutes };
  if (state.coming.some((p) => p.id === me)) return { kind: "coming" };
  const a = state.attendance.find((x) => x.player.id === me);
  if (a?.status === "break") return { kind: "break" };
  if (a?.status === "left") return { kind: "left" };
  return { kind: "out" };
}

export function Live({ token }: { token: string }) {
  const { data: state, setData, error } = useApi<SessionState>(`/api/live/${token}`, { pollMs: 15000 });
  const [me, setMe] = useState<string | null>(() => readItem(meKey(token)));
  const code = readItem(codeKey(token));
  const [picking, setPicking] = useState(false);
  const [joining, setJoining] = useState(false);
  const [joinBusy, setJoinBusy] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const { data: members } = useApi<CheckinRoster>(joining ? `/api/live/${token}/members` : null);
  const [alerts, setAlerts] = useState(() => typeof Notification !== "undefined" && Notification.permission === "granted");
  const [pulse, setPulse] = useState(false);
  const toast = useToast();
  const skew = useMemo(() => (state ? state.serverTime - Date.now() : 0), [state]);
  const now = useNow(1000) + skew;

  useCourtColors(state?.courtColors);
  const mine = state ? whereAmI(state, me) : ({ kind: "unknown" } as Mine);
  const myName =
    state?.attendance.find((a) => a.player.id === me)?.player.name ?? state?.coming.find((p) => p.id === me)?.name ?? null;

  // Buzz once when this player moves into Up Next or onto a court.
  const previous = useRef<Mine["kind"] | null>(null);
  useEffect(() => {
    const was = previous.current;
    previous.current = mine.kind;
    // Only when they were waiting, not on first load or after picking their name.
    if (!was || was === mine.kind || was === "unknown") return;
    if (mine.kind === "next" || mine.kind === "playing") {
      setPulse(true);
      setTimeout(() => setPulse(false), 2600);
      try {
        navigator.vibrate?.([220, 120, 220]);
      } catch {
        // not supported
      }
      if (alerts && document.visibilityState !== "visible") {
        try {
          new Notification(mine.kind === "next" ? "You're up next" : `You're on Court ${(mine as { court: number }).court}`, {
            body: state?.session.title,
            tag: "paqueuekame",
          });
        } catch {
          // Some phones only allow notifications from an installed app.
        }
      }
    }
  }, [mine.kind]);

  useEffect(() => {
    if (state) document.title = `${state.session.title} · NEXA`;
  }, [state?.session.title]);

  const chooseMe = (id: string | null) => {
    if (id) writeItem(meKey(token), id);
    else removeItem(meKey(token));
    setMe(id);
    setPicking(false);
  };

  /** "I'm coming": on the organizer's Coming list; they join the line when they check in at the court. */
  const comeAs = async (body: { playerId?: string; name?: string }) => {
    setJoinBusy(true);
    setJoinError(null);
    try {
      const res = await api<{ playerId: string; state: SessionState }>(`/api/live/${token}/coming`, { method: "POST", body });
      writeItem(meKey(token), res.playerId);
      setMe(res.playerId);
      setData(res.state);
      setJoining(false);
      toast("See you at the court");
    } catch (err) {
      setJoinError(errorMessage(err));
    } finally {
      setJoinBusy(false);
    }
  };

  const cancelComing = async () => {
    if (!me) return;
    try {
      setData(await api<SessionState>(`/api/live/${token}/coming/cancel`, { method: "POST", body: { playerId: me } }));
      toast("Thanks for letting us know");
    } catch (err) {
      toast(errorMessage(err));
    }
  };

  const setStatus = async (status: "in" | "break" | "left", done: string) => {
    if (!me || !code) return;
    try {
      setData(await api<SessionState>(`/api/live/${token}/status`, { method: "POST", body: { k: code, playerId: me, status } }));
      toast(done);
    } catch (err) {
      toast(errorMessage(err));
    }
  };

  const enableAlerts = async () => {
    if (typeof Notification === "undefined") {
      toast("This browser can't show alerts. Keep this page open; your phone will vibrate.");
      return;
    }
    const result = await Notification.requestPermission();
    setAlerts(result === "granted");
    toast(result === "granted" ? "We'll alert you when you're up" : "Alerts are blocked. Keep this page open instead.");
  };

  if (error && !state) {
    return (
      <main className="auth">
        <div className="auth-card">
          <div className="panel empty">
            <h1>Can't find this session</h1>
            <p className="muted">{error}</p>
          </div>
        </div>
      </main>
    );
  }
  if (!state) return <main className="auth muted">Loading the courts…</main>;

  const s = state.session;
  const live = s.status === "live";
  const detail = { results: state.results, teamName: state.teamName, title: s.title };

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
            <span className={`pill ${live ? "pill-live" : ""}`}>{live ? "Live" : "Ended"}</span>
            {s.venue && <span className="muted">{s.venue}</span>}
          </span>
          <h1>{s.title}</h1>
        </header>

        {live && (
          <YouCard
            mine={mine}
            name={myName}
            pulse={pulse}
            canAct={!!code && s.selfCheckin}
            canJoin={s.selfCheckin}
            alerts={alerts}
            onPick={() => setPicking(true)}
            onJoin={() => setJoining(true)}
            onCancelComing={cancelComing}
            onStatus={setStatus}
            onAlerts={enableAlerts}
          />
        )}

        <div className="board-grid two">
          <div className="stack">
            {live && state.next && (
              <section className="upnext" aria-label="Up next">
                <div className="upnext-head">
                  <h2>Up next</h2>
                  <span className="small">Get ready by the court</span>
                </div>
                <div className="upnext-teams">
                  <div className="upnext-team">
                    {state.next.team1.map((p) => (
                      <span key={p.id} className={p.id === me ? "chip is-you" : "chip"}>
                        {p.name}
                      </span>
                    ))}
                  </div>
                  <span className="upnext-vs">vs</span>
                  <div className="upnext-team">
                    {state.next.team2.map((p) => (
                      <span key={p.id} className={p.id === me ? "chip is-you" : "chip"}>
                        {p.name}
                      </span>
                    ))}
                  </div>
                </div>
              </section>
            )}
            {live && (
              <div className="courts">
                {state.courts.map((c) => (
                  <CourtCard key={c.court} court={c.court} match={c.match} now={now} youId={me} />
                ))}
              </div>
            )}
            {!live && (
              <>
                <SessionSummary stats={state.stats} />
                <section className="panel">
                  <div className="section-head">
                    <h2>Final standings</h2>
                  </div>
                  <Podium standings={state.standings} />
                  <Standings standings={state.standings} youId={me} detail={detail} />
                </section>
              </>
            )}
          </div>

          <aside className="stack sticky-side">
            {live && (
              <section className="panel panel-tight">
                <div className="section-head" style={{ padding: "8px 8px 0" }}>
                  <h2>Line</h2>
                  <span className="muted small">{plural(state.queue.length, "waiting", "waiting")}</span>
                </div>
                {state.queue.length === 0 ? (
                  <p className="muted" style={{ padding: "4px 12px 12px" }}>
                    No one is waiting.
                  </p>
                ) : (
                  <ol className="line-list">
                    {state.queue.map((q) => (
                      <li key={q.player.id} className={`line-item ${q.player.id === me ? "is-you" : ""}`}>
                        <span className="line-pos">{q.position}</span>
                        <span className="line-main">
                          <span className="line-name">
                            <span>{q.player.name}</span>
                            {q.player.id === me && <span className="pill">You</span>}
                          </span>
                          <span className="line-meta">{plural(q.games, "game")}</span>
                        </span>
                        <span className="line-side">
                          <b>~{minutes(q.estMinutes)}</b>
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            )}
            {live && state.standings.length > 0 && (
              <section className="panel">
                <div className="section-head">
                  <h2>Standings</h2>
                </div>
                <Standings standings={state.standings} limit={10} youId={me} detail={detail} />
              </section>
            )}
            {state.results.length > 0 && (
              <section className="panel">
                <div className="section-head">
                  <h2>Games</h2>
                </div>
                <GameLog results={live ? state.results.slice(0, 8) : state.results} />
              </section>
            )}
          </aside>
        </div>
        <p className="muted small">Updates every 15 seconds while this page is open.</p>
      </main>

      {picking && (
        <Sheet title="Which one is you?" onClose={() => setPicking(false)}>
          {state.attendance.length === 0 ? (
            <p className="muted">No one is checked in yet.</p>
          ) : (
            <ul className="pick-list">
              {state.attendance
                .filter((a) => a.status !== "left")
                .map((a) => (
                  <li key={a.player.id}>
                    <button type="button" className="pick" aria-pressed={a.player.id === me} onClick={() => chooseMe(a.player.id)}>
                      {a.player.name}
                      {a.player.id === me && <Icon name="check" />}
                    </button>
                  </li>
                ))}
            </ul>
          )}
          {me && (
            <button type="button" className="btn btn-ghost" onClick={() => chooseMe(null)}>
              I'm just watching
            </button>
          )}
        </Sheet>
      )}
      {joining && (
        <Sheet title="Who's coming?" onClose={() => setJoining(false)}>
          <p className="muted">
            The organizer will see you're on the way. You join the line when you check in at the court, so nobody loses their
            place to someone still at home.
          </p>
          {members ? (
            <NamePicker
              players={members.players.filter((p) => !state.attendance.some((a) => a.player.id === p.id && a.status !== "left"))}
              busy={joinBusy}
              failure={joinError}
              onPick={(p) => comeAs({ playerId: p.id })}
              onGuest={(name) => comeAs({ name })}
            />
          ) : (
            <p className="muted">Loading names…</p>
          )}
        </Sheet>
      )}
    </>
  );
}

function YouCard({
  mine,
  name,
  pulse,
  canAct,
  canJoin,
  alerts,
  onPick,
  onJoin,
  onCancelComing,
  onStatus,
  onAlerts,
}: {
  mine: Mine;
  name: string | null;
  pulse: boolean;
  canAct: boolean;
  canJoin: boolean;
  alerts: boolean;
  onPick: () => void;
  onJoin: () => void;
  onCancelComing: () => void;
  onStatus: (status: "in" | "break" | "left", done: string) => void;
  onAlerts: () => void;
}) {
  if (mine.kind === "unknown") {
    return (
      <section className="you-card">
        <p className="you-status">{canJoin ? "Playing today?" : "Where am I in line?"}</p>
        <p className="muted">
          {canJoin
            ? "Tap I'm coming so the organizer knows. Already checked in? Find your name to see your place."
            : "Tap your name to see your place and get an alert when you're up."}
        </p>
        <div className="row row-wrap">
          {canJoin && (
            <button type="button" className="btn btn-primary" onClick={onJoin}>
              I'm coming
            </button>
          )}
          <button type="button" className={canJoin ? "btn" : "btn btn-primary"} onClick={onPick}>
            Find my name
          </button>
        </div>
      </section>
    );
  }

  const view: Record<Mine["kind"], { cls: string; title: string; sub: string }> = {
    unknown: { cls: "", title: "", sub: "" },
    playing: { cls: "is-playing", title: `You're on Court ${(mine as { court: number }).court}`, sub: "Good luck out there." },
    next: { cls: "is-up", title: "You're up next", sub: "Head to the court and wait for a free one." },
    line: {
      cls: "",
      title: `${ordinal((mine as { position: number }).position)} in line`,
      sub: `About ${minutes((mine as { est: number }).est)} until you're up.`,
    },
    coming: {
      cls: "",
      title: "You're on the way",
      sub: "At the court, scan the QR code or tell the organizer you're here. That's when you join the line.",
    },
    break: { cls: "", title: "You're on break", sub: "Tap I'm back to join the back of the line." },
    left: { cls: "", title: "You went home", sub: "Check in again if you're staying." },
    out: { cls: "", title: "Not checked in", sub: "Scan the QR code at the court, or ask an organizer." },
  };
  const v = view[mine.kind];

  return (
    <section className={`you-card ${v.cls} ${pulse ? "pulse" : ""}`} aria-live="polite">
      <span className="muted small">
        {name ?? "You"}{" "}
        <button type="button" className="btn btn-ghost btn-sm" style={{ minHeight: 32, padding: "0 6px" }} onClick={onPick}>
          Not you?
        </button>
      </span>
      <p className="you-status">{v.title}</p>
      <p className="muted">{v.sub}</p>
      <div className="row row-wrap">
        {mine.kind === "coming" && (
          <button type="button" className="btn btn-sm" onClick={onCancelComing}>
            Can't make it
          </button>
        )}
        {canJoin && (mine.kind === "out" || mine.kind === "left") && !canAct && (
          <button type="button" className="btn btn-sm btn-primary" onClick={onJoin}>
            I'm coming
          </button>
        )}
        {canAct && mine.kind === "line" && (
          <button type="button" className="btn btn-sm" onClick={() => onStatus("break", "You're on break")}>
            Take a break
          </button>
        )}
        {canAct && (mine.kind === "break" || mine.kind === "left") && (
          <button type="button" className="btn btn-sm btn-primary" onClick={() => onStatus("in", "You're back in line")}>
            I'm back
          </button>
        )}
        {canAct && (mine.kind === "line" || mine.kind === "break") && (
          <button type="button" className="btn btn-sm" onClick={() => onStatus("left", "Thanks for playing")}>
            I'm going home
          </button>
        )}
        {!alerts && (mine.kind === "line" || mine.kind === "break") && (
          <button type="button" className="btn btn-sm" onClick={onAlerts}>
            <Icon name="bell" /> Alert me when I'm up
          </button>
        )}
      </div>
    </section>
  );
}
