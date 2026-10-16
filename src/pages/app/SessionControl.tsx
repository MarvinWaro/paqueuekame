import { type FormEvent, useMemo, useState } from "react";
import type { Attendance, MatchView, Player, RosterPlayer, SessionState } from "../../../shared/types";
import { CourtCard } from "../../components/Court";
import { Icon } from "../../components/Icon";
import { QrCode } from "../../components/QrCode";
import { Sheet } from "../../components/Sheet";
import { Skill } from "../../components/Skill";
import { useToast } from "../../components/Toast";
import { api, errorMessage } from "../../lib/api";
import { minutes, names, plural, since, timeLabel } from "../../lib/format";
import { Link } from "../../lib/router";
import { useApi, useNow } from "../../lib/useApi";
import { GameLog, Standings } from "../Results";

type Tab = "courts" | "line" | "players" | "results";
type Act = (path: string, body?: unknown, done?: string, method?: "POST" | "PATCH") => Promise<boolean>;

export function SessionControl({ id }: { id: string }) {
  const { data: state, setData, error } = useApi<SessionState>(`/api/sessions/${id}`, { pollMs: 5000 });
  const [tab, setTab] = useState<Tab>("courts");
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  // Use the server's clock for game timers, in case this phone's clock is off.
  const skew = useMemo(() => (state ? state.serverTime - Date.now() : 0), [state]);
  const now = useNow(1000) + skew;

  const act: Act = async (path, body, done, method = "POST") => {
    setBusy(true);
    try {
      setData(await api<SessionState>(`/api/sessions/${id}${path}`, { method, body }));
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
      <div className="page">
        <div className="panel empty">
          <h1>Can't open this session</h1>
          <p className="muted">{error}</p>
          <Link to="/app/sessions" className="btn">
            Go to sessions
          </Link>
        </div>
      </div>
    );
  }
  if (!state) return <div className="page muted">Loading the courts…</div>;

  const s = state.session;
  if (s.status === "ended") return <EndedSession state={state} />;

  const playing = state.courts.filter((c) => c.match).length * 4;
  const onBreak = state.attendance.filter((a) => a.status === "break").length;

  return (
    <div className="page">
      <SessionHeader state={state} act={act} busy={busy} counts={{ playing, line: state.queue.length, onBreak }} />

      <div className="tabs" role="tablist" aria-label="Session">
        {(
          [
            ["courts", "Courts", null],
            ["line", "Line", state.queue.length],
            ["players", "Check in", state.attendance.filter((a) => a.status !== "left").length],
            ["results", "Results", state.results.length],
          ] as [Tab, string, number | null][]
        ).map(([key, label, count]) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)}>
            {label}
            {count !== null && <span className="tab-count">{count}</span>}
          </button>
        ))}
      </div>

      {tab === "courts" && (
        <div className="board-grid two">
          <div className="stack">
            <UpNext state={state} act={act} busy={busy} />
            <div className="courts">
              {state.courts.map((c) => (
                <CourtControl key={c.court} court={c.court} match={c.match} now={now} act={act} busy={busy} hasNext={!!state.next} />
              ))}
            </div>
          </div>
          <aside className="sticky-side desktop-only">
            <LineList state={state} act={act} now={now} />
          </aside>
        </div>
      )}
      {tab === "line" && <LineList state={state} act={act} now={now} />}
      {tab === "players" && <CheckIn state={state} act={act} />}
      {tab === "results" && (
        <div className="two-col">
          <section className="panel">
            <div className="section-head">
              <h2>Standings</h2>
            </div>
            <Standings standings={state.standings} />
          </section>
          <section className="panel">
            <div className="section-head">
              <h2>Games</h2>
            </div>
            <GameLog results={state.results} onUndo={(m) => act(`/matches/${m.id}/undo`, undefined, `Court ${m.court} is back on`)} />
          </section>
        </div>
      )}
    </div>
  );
}

// ---------- Header, share, settings ----------

function SessionHeader({
  state,
  act,
  busy,
  counts,
}: {
  state: SessionState;
  act: Act;
  busy: boolean;
  counts: { playing: number; line: number; onBreak: number };
}) {
  const [sheet, setSheet] = useState<"qr" | "settings" | null>(null);
  const toast = useToast();
  const s = state.session;
  const liveUrl = `${location.origin}/live/${s.liveToken}`;

  const share = async () => {
    const data = { title: s.title, text: `Live courts and line for ${s.title}`, url: liveUrl };
    try {
      if (navigator.share) {
        await navigator.share(data);
        return;
      }
    } catch {
      return; // the person closed the share menu
    }
    try {
      await navigator.clipboard.writeText(liveUrl);
      toast("Live link copied. Paste it in your group chat.");
    } catch {
      toast(liveUrl);
    }
  };

  return (
    <header className="session-head">
      <div className="session-title-row">
        <div className="stack" style={{ gap: 6 }}>
          <span className="row">
            <span className="pill pill-live">Live</span>
            {s.venue && <span className="muted">{s.venue}</span>}
          </span>
          <h1>{s.title}</h1>
        </div>
        <button type="button" className="icon-btn" onClick={() => setSheet("settings")} aria-label="Session settings" title="Session settings">
          <Icon name="gear" />
        </button>
      </div>
      <div className="counts">
        <span className="count">
          <b className="num">{counts.playing}</b> playing
        </span>
        <span className="count">
          <b className="num">{counts.line}</b> in line
        </span>
        {counts.onBreak > 0 && (
          <span className="count">
            <b className="num">{counts.onBreak}</b> on break
          </span>
        )}
      </div>
      <div className="row row-wrap">
        <button type="button" className="btn btn-sm" onClick={share}>
          <Icon name="share" /> Share live link
        </button>
        <button type="button" className="btn btn-sm" onClick={() => setSheet("qr")}>
          <Icon name="qr" /> Check-in QR
        </button>
      </div>

      {sheet === "qr" && (
        <Sheet title="Check-in QR" onClose={() => setSheet(null)}>
          {s.selfCheckin && state.checkinToken ? (
            <>
              <QrCode
                text={`${location.origin}/live/${s.liveToken}/checkin?k=${state.checkinToken}`}
                label="QR code for players to check in"
              />
              <p className="muted">
                Show this at the court. Players scan it, tap their name, and join the back of the line. Only people at the court should
                see it, so don't post it in the group chat.
              </p>
            </>
          ) : (
            <p className="muted">Self check-in is off for this session. Turn it on in session settings, or check players in yourself.</p>
          )}
        </Sheet>
      )}
      {sheet === "settings" && <SessionSettings state={state} act={act} busy={busy} onClose={() => setSheet(null)} />}
    </header>
  );
}

function SessionSettings({ state, act, busy, onClose }: { state: SessionState; act: Act; busy: boolean; onClose: () => void }) {
  const s = state.session;
  const [courts, setCourts] = useState(s.courtCount);
  const [self, setSelf] = useState(s.selfCheckin);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const onCourt = state.courts.filter((c) => c.match).length;

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (await act("", { courtCount: courts, selfCheckin: self }, "Session updated", "PATCH")) onClose();
  };

  return (
    <Sheet title="Session settings" onClose={onClose}>
      <form className="stack" onSubmit={save}>
        <div className="row spread">
          <span style={{ fontWeight: 650 }}>Courts</span>
          <div className="stepper">
            <button type="button" onClick={() => setCourts((c) => Math.max(1, c - 1))} aria-label="One court fewer" disabled={courts <= 1}>
              <Icon name="minus" />
            </button>
            <output aria-label={`${courts} courts`}>{courts}</output>
            <button type="button" onClick={() => setCourts((c) => Math.min(12, c + 1))} aria-label="One more court" disabled={courts >= 12}>
              <Icon name="plus" />
            </button>
          </div>
        </div>
        <label className="switch">
          <span>
            <span style={{ display: "block", fontWeight: 650 }}>Self check-in</span>
            <span className="muted small">Players can check in and take breaks from the court QR.</span>
          </span>
          <input type="checkbox" checked={self} onChange={(e) => setSelf(e.target.checked)} />
        </label>
        <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
          Save settings
        </button>
      </form>
      <hr style={{ border: 0, borderTop: "1px solid var(--line)", width: "100%" }} />
      {confirmEnd ? (
        <div className="stack" style={{ gap: 10 }}>
          <p>
            End {s.title}?
            {onCourt > 0 && ` ${plural(onCourt, "game")} still on court won't count.`} Standings stay in History.
          </p>
          <div className="row">
            <button
              type="button"
              className="btn btn-danger-solid"
              disabled={busy}
              onClick={async () => {
                if (await act("/end", undefined, "Session ended")) onClose();
              }}
            >
              End session
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setConfirmEnd(false)}>
              Keep playing
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="btn btn-ghost btn-danger" onClick={() => setConfirmEnd(true)}>
          End session
        </button>
      )}
    </Sheet>
  );
}

// ---------- Up Next ----------

function UpNext({ state, act, busy }: { state: SessionState; act: Act; busy: boolean }) {
  const [swapOut, setSwapOut] = useState<Player | null>(null);
  const next = state.next;
  const free = state.courts.filter((c) => !c.match && c.court <= state.session.courtCount).map((c) => c.court);

  if (!next) {
    const waiting = state.queue.length;
    return (
      <section className="upnext is-empty" aria-label="Up next">
        <div className="upnext-head">
          <h2>Up next</h2>
        </div>
        <p className="muted">
          {waiting === 0
            ? "Check players in to start the line."
            : `Up Next needs 4 players in line. ${plural(waiting, "player")} waiting.`}
        </p>
      </section>
    );
  }

  const chip = (p: Player) => (
    <button key={p.id} type="button" className="chip" onClick={() => setSwapOut(p)} aria-label={`Swap ${p.name}`}>
      {p.name}
    </button>
  );

  return (
    <section className="upnext" aria-label="Up next">
      <div className="upnext-head">
        <h2>Up next</h2>
        <span className="small">Tap a name to swap</span>
      </div>
      <div className="upnext-teams">
        <div className="upnext-team">{next.team1.map(chip)}</div>
        <span className="upnext-vs">vs</span>
        <div className="upnext-team">{next.team2.map(chip)}</div>
      </div>
      <div className="upnext-actions">
        {free.length > 0 ? (
          free.map((c) => (
            <button key={c} type="button" className="btn btn-primary" disabled={busy} onClick={() => act("/next/start", { court: c }, `Court ${c} started`)}>
              Start on Court {c}
            </button>
          ))
        ) : (
          <span className="small" style={{ alignSelf: "center", marginRight: "auto" }}>
            Waiting for a court to finish
          </span>
        )}
        <button type="button" className="btn" disabled={busy} onClick={() => act("/next/shuffle", undefined, "New Up Next")}>
          <Icon name="shuffle" /> Shuffle
        </button>
      </div>

      {swapOut && (
        <Sheet title={`Swap ${swapOut.name}`} onClose={() => setSwapOut(null)}>
          {state.queue.length === 0 ? (
            <p className="muted">No one else is waiting right now.</p>
          ) : (
            <>
              <p className="muted">{swapOut.name} goes back to their place in line.</p>
              <ul className="pick-list">
                {state.queue.map((q) => (
                  <li key={q.player.id}>
                    <button
                      type="button"
                      className="pick"
                      disabled={busy}
                      onClick={async () => {
                        if (await act("/next/swap", { out: swapOut.id, in: q.player.id }, `${q.player.name} is up next`)) setSwapOut(null);
                      }}
                    >
                      <span className="row">
                        <span className="num muted">{q.position}</span>
                        {q.player.name}
                        <Skill value={q.player.skill} />
                      </span>
                      <span className="muted small">{plural(q.games, "game")}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Sheet>
      )}
    </section>
  );
}

// ---------- Courts ----------

function CourtControl({
  court,
  match,
  now,
  act,
  busy,
  hasNext,
}: {
  court: number;
  match: MatchView | null;
  now: number;
  act: Act;
  busy: boolean;
  hasNext: boolean;
}) {
  const [result, setResult] = useState<1 | 2 | null>(null);
  const [menu, setMenu] = useState(false);

  return (
    <CourtCard
      court={court}
      match={match}
      now={now}
      menu={
        match && (
          <button type="button" className="icon-btn" onClick={() => setMenu(true)} aria-label={`More for Court ${court}`} title="More">
            <Icon name="more" />
          </button>
        )
      }
    >
      {match ? (
        <>
          <div className="court-actions">
            <button type="button" className="btn" onClick={() => setResult(1)}>
              {names(match.team1)} won
            </button>
            <button type="button" className="btn" onClick={() => setResult(2)}>
              {names(match.team2)} won
            </button>
          </div>
        </>
      ) : (
        <div className="court-free">
          {hasNext ? (
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => act("/next/start", { court }, `Court ${court} started`)}>
              Start Up Next here
            </button>
          ) : (
            <p className="muted small">Up Next goes here once 4 players are waiting.</p>
          )}
        </div>
      )}

      {match && result && <ResultSheet match={match} winner={result} onClose={() => setResult(null)} act={act} busy={busy} />}
      {match && menu && (
        <Sheet title={`Court ${court}`} onClose={() => setMenu(false)}>
          <p className="muted">
            Take this game off the court without a result. All 4 players go back to the front of the line in their old places.
          </p>
          <button
            type="button"
            className="btn btn-danger-solid btn-block"
            disabled={busy}
            onClick={async () => {
              if (await act(`/matches/${match.id}/cancel`, undefined, `Court ${court} cleared`)) setMenu(false);
            }}
          >
            Cancel this game
          </button>
        </Sheet>
      )}
    </CourtCard>
  );
}

function ResultSheet({ match, winner: initial, onClose, act, busy }: { match: MatchView; winner: 1 | 2; onClose: () => void; act: Act; busy: boolean }) {
  const [winner, setWinner] = useState<1 | 2>(initial);
  const [score1, setScore1] = useState("");
  const [score2, setScore2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const s1 = score1 === "" ? null : Number(score1);
    const s2 = score2 === "" ? null : Number(score2);
    if ((s1 === null) !== (s2 === null)) return setError("Enter both scores, or leave both empty.");
    if (s1 !== null && s2 !== null && (winner === 1 ? s1 <= s2 : s2 <= s1)) return setError("The winning team needs the higher score.");
    setError(null);
    const ok = await act(`/matches/${match.id}/result`, { winner, score1: s1, score2: s2 });
    if (ok) {
      onClose();
      toast(`Saved: ${names(winner === 1 ? match.team1 : match.team2)} won`, {
        label: "Undo",
        run: () => void act(`/matches/${match.id}/undo`, undefined, `Court ${match.court} is back on`),
      });
    }
  };

  return (
    <Sheet title={`Court ${match.court} result`} onClose={onClose}>
      <form className="stack" onSubmit={save}>
        <div className="winner-pick" role="group" aria-label="Winning team">
          <button type="button" className="pick" aria-pressed={winner === 1} onClick={() => setWinner(1)}>
            {names(match.team1)}
          </button>
          <button type="button" className="pick" aria-pressed={winner === 2} onClick={() => setWinner(2)}>
            {names(match.team2)}
          </button>
        </div>
        <div className="score-entry">
          <div className="field">
            <label htmlFor="s1" className="small">
              {names(match.team1)}
            </label>
            <input id="s1" className="input" inputMode="numeric" pattern="[0-9]*" maxLength={2} value={score1} onChange={(e) => setScore1(e.target.value.replace(/\D/g, ""))} placeholder="–" />
          </div>
          <span className="upnext-vs" style={{ paddingBottom: 16 }}>
            to
          </span>
          <div className="field">
            <label htmlFor="s2" className="small">
              {names(match.team2)}
            </label>
            <input id="s2" className="input" inputMode="numeric" pattern="[0-9]*" maxLength={2} value={score2} onChange={(e) => setScore2(e.target.value.replace(/\D/g, ""))} placeholder="–" />
          </div>
        </div>
        <p className="muted small">The score is optional. It's used for point difference in the standings.</p>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
          Save result
        </button>
      </form>
    </Sheet>
  );
}

// ---------- The line ----------

function LineList({ state, act, now }: { state: SessionState; act: Act; now: number }) {
  const [picked, setPicked] = useState<Attendance | null>(null);
  const onBreak = state.attendance.filter((a) => a.status === "break");
  const find = (id: string) => state.attendance.find((a) => a.player.id === id) ?? null;

  return (
    <section className="stack">
      <div className="panel panel-tight">
        <div className="section-head" style={{ padding: "8px 8px 0" }}>
          <h2>Line</h2>
          <span className="muted small">Games take about {minutes(state.avgGameMinutes)}</span>
        </div>
        {state.queue.length === 0 ? (
          <p className="muted" style={{ padding: "4px 12px 12px" }}>
            {state.next ? "Everyone who's waiting is in Up Next." : "No one is waiting."}
          </p>
        ) : (
          <ol className="line-list">
            {state.queue.map((q) => (
              <li key={q.player.id}>
                <button type="button" className="line-item" onClick={() => setPicked(find(q.player.id))}>
                  <span className="line-pos">{q.position}</span>
                  <span className="line-main">
                    <span className="line-name">
                      <span>{q.player.name}</span>
                      {q.player.isGuest && <span className="pill pill-guest">Guest</span>}
                      <Skill value={q.player.skill} />
                    </span>
                    <span className="line-meta">
                      {plural(q.games, "game")}, waiting {since(q.waitingSince, now)}
                    </span>
                  </span>
                  <span className="line-side">
                    <b>~{minutes(q.estMinutes)}</b>
                    until up
                  </span>
                </button>
              </li>
            ))}
          </ol>
        )}
      </div>

      {onBreak.length > 0 && (
        <div className="panel panel-tight">
          <div className="section-head" style={{ padding: "8px 8px 0" }}>
            <h2>On break</h2>
          </div>
          <ul className="line-list">
            {onBreak.map((a) => (
              <li key={a.player.id} className="line-item">
                <span className="line-main">
                  <span className="line-name">
                    <span>{a.player.name}</span>
                  </span>
                  <span className="line-meta">{plural(a.games, "game")}</span>
                </span>
                <button type="button" className="btn btn-sm" onClick={() => act(`/players/${a.player.id}/status`, { status: "in" }, `${a.player.name} is back in line`)}>
                  Back in line
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {picked && <PlayerActions attendance={picked} act={act} onClose={() => setPicked(null)} />}
    </section>
  );
}

function PlayerActions({ attendance, act, onClose }: { attendance: Attendance; act: Act; onClose: () => void }) {
  const p = attendance.player;
  const run = async (status: "in" | "break" | "left", done: string) => {
    if (await act(`/players/${p.id}/status`, { status }, done)) onClose();
  };
  return (
    <Sheet title={p.name} onClose={onClose}>
      <p className="muted">{plural(attendance.games, "game")} this session.</p>
      <div className="stack" style={{ gap: 8 }}>
        {attendance.status !== "in" && (
          <button type="button" className="btn btn-primary btn-block" onClick={() => run("in", `${p.name} is back in line`)}>
            Back in line
          </button>
        )}
        {attendance.status !== "break" && (
          <button type="button" className="btn btn-block" onClick={() => run("break", `${p.name} is on break`)}>
            Take a break
          </button>
        )}
        {attendance.status !== "left" && (
          <button type="button" className="btn btn-block btn-danger" onClick={() => run("left", `${p.name} went home`)}>
            Went home
          </button>
        )}
      </div>
      <p className="muted small">Players coming back from a break join the back of the line.</p>
    </Sheet>
  );
}

// ---------- Check in ----------

function CheckIn({ state, act }: { state: SessionState; act: Act }) {
  const { data: roster } = useApi<RosterPlayer[]>("/api/players");
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Attendance | null>(null);
  const status = new Map(state.attendance.map((a) => [a.player.id, a]));
  const busyIds = new Set(
    [...state.courts.flatMap((c) => (c.match ? [...c.match.team1, ...c.match.team2] : [])), ...(state.next ? [...state.next.team1, ...state.next.team2] : [])].map((p) => p.id),
  );
  const q = query.trim().toLowerCase();
  const list = (roster ?? []).filter((p) => !q || p.name.toLowerCase().includes(q));
  const notHere = list.filter((p) => !status.has(p.id) || status.get(p.id)!.status === "left");
  const here = list.filter((p) => status.has(p.id) && status.get(p.id)!.status !== "left");
  const exact = (roster ?? []).some((p) => p.name.toLowerCase() === q);

  const label = (p: RosterPlayer) => {
    const a = status.get(p.id)!;
    if (a.status === "break") return "On break";
    if (state.next && [...state.next.team1, ...state.next.team2].some((x) => x.id === p.id)) return "Up next";
    if (busyIds.has(p.id)) {
      const c = state.courts.find((c) => c.match && [...c.match.team1, ...c.match.team2].some((x) => x.id === p.id));
      return `Court ${c?.court}`;
    }
    return `#${state.queue.find((x) => x.player.id === p.id)?.position ?? "–"} in line`;
  };

  return (
    <section className="stack">
      <div className="input-prefix">
        <span>
          <Icon name="search" />
        </span>
        <input className="input" type="search" placeholder="Find or add a name" aria-label="Find or add a name" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      {q && !exact && (
        <button type="button" className="btn btn-block" onClick={() => act("/checkin", { name: query.trim() }, `${query.trim()} checked in as a guest`).then((ok) => ok && setQuery(""))}>
          <Icon name="plus" /> Check in “{query.trim()}” as a guest
        </button>
      )}

      <div className="panel panel-tight">
        <div className="section-head" style={{ padding: "8px 8px 0" }}>
          <h2>Not here yet</h2>
          <span className="muted small">{notHere.length}</span>
        </div>
        {!roster && <p className="muted" style={{ padding: 12 }}>Loading the roster…</p>}
        {roster && notHere.length === 0 && (
          <p className="muted" style={{ padding: "4px 12px 12px" }}>
            {roster.length === 0 ? (
              <>
                Your roster is empty. <Link to="/app/players">Add players</Link> first.
              </>
            ) : (
              "Everyone on the roster is checked in."
            )}
          </p>
        )}
        <ul className="line-list">
          {notHere.map((p) => (
            <li key={p.id} className="line-item">
              <span className="line-main">
                <span className="line-name">
                  <span>{p.name}</span>
                  {p.isGuest && <span className="pill pill-guest">Guest</span>}
                  <Skill value={p.skill} />
                </span>
                {status.get(p.id)?.status === "left" && <span className="line-meta">Went home</span>}
              </span>
              <button type="button" className="btn btn-sm btn-primary" onClick={() => act("/checkin", { playerId: p.id }, `${p.name} checked in`)}>
                Check in
              </button>
            </li>
          ))}
        </ul>
      </div>

      {here.length > 0 && (
        <div className="panel panel-tight">
          <div className="section-head" style={{ padding: "8px 8px 0" }}>
            <h2>Here</h2>
            <span className="muted small">{here.length}</span>
          </div>
          <ul className="line-list">
            {here.map((p) => (
              <li key={p.id}>
                <button type="button" className="line-item" onClick={() => setPicked(status.get(p.id)!)}>
                  <span className="line-main">
                    <span className="line-name">
                      <span>{p.name}</span>
                    </span>
                    <span className="line-meta">{plural(status.get(p.id)!.games, "game")}</span>
                  </span>
                  <span className="line-side">
                    <b>{label(p)}</b>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {picked && <PlayerActions attendance={picked} act={act} onClose={() => setPicked(null)} />}
    </section>
  );
}

// ---------- Ended ----------

function EndedSession({ state }: { state: SessionState }) {
  const s = state.session;
  return (
    <div className="page">
      <header className="session-head">
        <span className="row">
          <span className="pill">Ended {s.endedAt ? timeLabel(s.endedAt) : ""}</span>
          {s.venue && <span className="muted">{s.venue}</span>}
        </span>
        <h1>{s.title}</h1>
        <div className="counts">
          <span className="count">
            <b className="num">{s.gameCount}</b> {s.gameCount === 1 ? "game" : "games"}
          </span>
          <span className="count">
            <b className="num">{s.playerCount}</b> {s.playerCount === 1 ? "player" : "players"}
          </span>
        </div>
      </header>
      <div className="two-col">
        <section className="panel">
          <div className="section-head">
            <h2>Standings</h2>
          </div>
          <Standings standings={state.standings} />
        </section>
        <section className="panel">
          <div className="section-head">
            <h2>Games</h2>
          </div>
          <GameLog results={state.results} />
        </section>
      </div>
      <Link to="/app/sessions" className="btn">
        Start another session
      </Link>
    </div>
  );
}
