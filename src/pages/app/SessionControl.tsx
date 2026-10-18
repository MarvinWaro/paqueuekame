import { type FormEvent, type ReactNode, useMemo, useState } from "react";
import type { Attendance, MatchView, Player, RosterPlayer, SessionState, UmpireInfo } from "../../../shared/types";
import { type MatchMode, matchModeOf } from "../../../shared/matchModes";
import { CourtCard } from "../../components/Court";
import { CourtStepper } from "../../components/CourtStepper";
import { ModePicker } from "../../components/ModePicker";
import { Icon } from "../../components/Icon";
import { QrCode } from "../../components/QrCode";
import { Sheet } from "../../components/Sheet";
import { Skill } from "../../components/Skill";
import { useToast } from "../../components/Toast";
import { api, errorMessage } from "../../lib/api";
import { minutes, names, plural, since } from "../../lib/format";
import { Link, goBack } from "../../lib/router";
import { shareText } from "../../lib/share";
import { useApi, useNow } from "../../lib/useApi";
import { GameLog, Podium, SessionSummary, Standings, standingsText } from "../Results";
import { Loading } from "../../components/Loading";
import type { DriveStep } from "driver.js";
import { useTour } from "../../lib/tour";

type Tab = "courts" | "line" | "players" | "results";

/** First time on a court screen: the few controls an organizer needs. */
const courtTour = (): DriveStep[] => [
  {
    element: '[data-tour="invite"]',
    popover: {
      title: "Invite to join",
      description: "Post this link in your group chat. Members tap I'm coming and follow the courts live on their phones.",
    },
  },
  {
    element: '[data-tour="qr"]',
    popover: {
      title: "Check-in QR",
      description: "Show or print this at the court. Players scan it when they arrive to join the back of the line.",
    },
  },
  {
    element: '[data-tour="tab-players"]',
    popover: {
      title: "Check players in",
      description: "Tick names, or Select all. The starting order is shuffled, so the alphabet doesn't decide who plays first.",
    },
  },
  {
    element: '[data-tour="upnext"]',
    popover: {
      title: "Up next",
      description: "NEXA keeps the next game ready from the line. Tap a name to swap, Shuffle for new pairs, then start it on a free court.",
    },
  },
  {
    element: '[data-tour="courts"] > :first-child',
    popover: {
      title: "Courts",
      description: "When a game ends, tap who won. A score is optional. Tap a name on court to swap a player.",
    },
  },
  {
    element: '[data-tour="settings"]',
    popover: {
      title: "Session settings",
      description: "Change the matching mode or courts, add umpires who score from their phone, and end the session.",
    },
  },
];
type Act = (path: string, body?: unknown, done?: string, method?: "POST" | "PATCH" | "DELETE") => Promise<boolean>;

export function SessionControl({ id }: { id: string }) {
  const { data: state, setData, error } = useApi<SessionState>(`/api/sessions/${id}`, { pollMs: 5000 });
  const [tab, setTab] = useState<Tab>("courts");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<MatchView | null>(null);
  const toast = useToast();
  // Use the server's clock for game timers, in case this phone's clock is off.
  const skew = useMemo(() => (state ? state.serverTime - Date.now() : 0), [state]);
  const now = useNow(1000) + skew;
  useTour("court", courtTour, state?.session.status === "live");

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
  if (!state) return <div className="page"><Loading label="Loading the courts…" /></div>;

  const s = state.session;
  const editSheet = editing && (
    <ResultSheet match={editing} winner={editing.winner ?? 1} edit onClose={() => setEditing(null)} act={act} busy={busy} />
  );
  if (s.status === "ended") {
    return (
      <>
        <EndedSession state={state} onEdit={setEditing} />
        {editSheet}
      </>
    );
  }

  const playing = state.courts.filter((c) => c.match).length * 4;
  const canUndo = state.undoUntil !== null && now < state.undoUntil;
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
          <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)} data-tour={`tab-${key}`}>
            {label}
            {count !== null && <span className="tab-count">{count}</span>}
          </button>
        ))}
      </div>

      {tab === "courts" && (
        <div className="board-grid two">
          <div className="stack">
            <UpNext state={state} act={act} busy={busy} />
            <div className="courts" data-tour="courts">
              {state.courts.map((c) => (
                <CourtControl
                  key={c.court}
                  court={c.court}
                  match={c.match}
                  now={now}
                  act={act}
                  busy={busy}
                  nextId={state.next?.id ?? null}
                  queue={state.queue}
                />
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
            <Standings standings={state.standings} detail={{ results: state.results, teamName: state.teamName, title: s.title }} />
          </section>
          <section className="panel">
            <div className="section-head">
              <h2>Games</h2>
            </div>
            <GameLog
              results={state.results}
              onUndo={canUndo ? (m) => act(`/matches/${m.id}/undo`, undefined, `Court ${m.court} is back on`) : undefined}
              onEdit={setEditing}
            />
          </section>
        </div>
      )}
      {editSheet}
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

  // For the club group chat: members follow the courts and tap "I'm coming". Joining the line still happens at the court.
  const invite = async () => {
    const where = s.venue ? ` at ${s.venue}` : "";
    const text = state.session.selfCheckin
      ? `${s.title}${where} is on! Tap to see the courts and say you're coming:`
      : `${s.title}${where} is on! Follow the courts and the line here:`;
    const result = await shareText(s.title, text, liveUrl);
    if (result === "copied") toast("Invite copied. Paste it in your group chat.");
    if (result === "failed") toast(liveUrl);
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
        <button
          type="button"
          className="icon-btn"
          onClick={() => setSheet("settings")}
          aria-label="Session settings"
          title="Session settings"
          data-tour="settings"
        >
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
        <button type="button" className="btn btn-sm" onClick={invite} data-tour="invite">
          <Icon name="share" /> Invite to join
        </button>
        <button type="button" className="btn btn-sm" onClick={() => setSheet("qr")} data-tour="qr">
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
  const [mode, setMode] = useState<MatchMode>(matchModeOf(s.mode));
  const [confirmEnd, setConfirmEnd] = useState(false);
  const onCourt = state.courts.filter((c) => c.match).length;

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (await act("", { courtCount: courts, selfCheckin: self, mode }, mode !== s.mode ? "Mode changed. Up Next was rebuilt." : "Session updated", "PATCH")) onClose();
  };

  return (
    <Sheet title="Session settings" onClose={onClose}>
      <form className="stack" onSubmit={save}>
        <div className="row spread">
          <span style={{ fontWeight: 650 }}>Courts</span>
          <CourtStepper value={courts} onChange={setCourts} />
        </div>
        <div className="field">
          <span style={{ fontWeight: 650 }}>Matching mode</span>
          <ModePicker value={mode} onChange={setMode} />
          <span className="hint">Changing it rebuilds Up Next. Games on court aren't affected.</span>
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
      <Umpires state={state} act={act} busy={busy} />
      <hr style={{ border: 0, borderTop: "1px solid var(--line)", width: "100%" }} />
      {confirmEnd ? (
        <div className="stack" style={{ gap: 10 }}>
          <p>
            End {s.title}?
            {onCourt > 0 && ` ${plural(onCourt, "game")} still on court won't count.`} Standings stay in the Club tab.
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
  const start = useStartOnCourt(act);
  const next = state.next;
  const free = state.courts.filter((c) => !c.match && c.court <= state.session.courtCount).map((c) => c.court);

  if (!next) {
    const waiting = state.queue.length;
    return (
      <section className="upnext is-empty" aria-label="Up next" data-tour="upnext">
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
    <section className="upnext" aria-label="Up next" data-tour="upnext">
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
            <button key={c} type="button" className="btn btn-primary" disabled={busy} onClick={() => start(c, next.id)}>
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
        <SwapSheet
          out={swapOut}
          queue={state.queue}
          busy={busy}
          onClose={() => setSwapOut(null)}
          onPick={async (q) => {
            if (await act("/next/swap", { out: swapOut.id, in: q.player.id }, `${q.player.name} is up next`)) setSwapOut(null);
          }}
        />
      )}
    </section>
  );
}

/** Pick who comes in for `out`, from the players waiting in line. `children` sits above the list. */
function SwapSheet({
  out,
  queue,
  busy,
  onPick,
  onClose,
  children,
}: {
  out: Player;
  queue: SessionState["queue"];
  busy: boolean;
  onPick: (q: SessionState["queue"][number]) => void;
  onClose: () => void;
  children?: ReactNode;
}) {
  return (
    <Sheet title={`Swap ${out.name}`} onClose={onClose}>
      {queue.length === 0 ? (
        <p className="muted">No one else is waiting right now.</p>
      ) : (
        <>
          {children ?? <p className="muted">{out.name} goes back to their place in line.</p>}
          <ul className="pick-list">
            {queue.map((q) => (
              <li key={q.player.id}>
                <button type="button" className="pick" disabled={busy} onClick={() => onPick(q)}>
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
  );
}

// ---------- Courts ----------

/** Starts Up Next on a court. The toast's Undo moves the game straight back to Up Next. */
function useStartOnCourt(act: Act) {
  const toast = useToast();
  return async (court: number, nextId: string) => {
    if (await act("/next/start", { court })) {
      toast(`Court ${court} started`, {
        label: "Undo",
        run: () => void act(`/matches/${nextId}/unstart`, undefined, "Moved back to Up Next"),
      });
    }
  };
}

function CourtControl({
  court,
  match,
  now,
  act,
  busy,
  nextId,
  queue,
}: {
  court: number;
  match: MatchView | null;
  now: number;
  act: Act;
  busy: boolean;
  nextId: string | null;
  queue: SessionState["queue"];
}) {
  const start = useStartOnCourt(act);
  const [result, setResult] = useState<1 | 2 | null>(null);
  const [menu, setMenu] = useState(false);
  const [swapOut, setSwapOut] = useState<Player | null>(null);
  const [onBreak, setOnBreak] = useState(false);

  return (
    <CourtCard
      court={court}
      match={match}
      now={now}
      onPlayer={(p) => {
        setOnBreak(false);
        setSwapOut(p);
      }}
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
          {nextId ? (
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => start(court, nextId)}>
              Start Up Next here
            </button>
          ) : (
            <p className="muted small">Up Next goes here once 4 players are waiting.</p>
          )}
        </div>
      )}

      {match && result && <ResultSheet match={match} winner={result} onClose={() => setResult(null)} act={act} busy={busy} />}
      {match && swapOut && (
        <SwapSheet
          out={swapOut}
          queue={queue}
          busy={busy}
          onClose={() => setSwapOut(null)}
          onPick={async (q) => {
            const done = `${q.player.name} is on Court ${court}${onBreak ? `. ${swapOut.name} is on break` : ""}`;
            if (await act(`/matches/${match.id}/swap`, { out: swapOut.id, in: q.player.id, outOnBreak: onBreak }, done)) {
              setSwapOut(null);
            }
          }}
        >
          <p className="muted">The game keeps going. {swapOut.name} goes back to their place in line.</p>
          <label className="switch">
            <span>
              <span style={{ display: "block", fontWeight: 650 }}>Also put {swapOut.name} on break</span>
              <span className="muted small">For a no-show. They won't be picked again until they're back.</span>
            </span>
            <input type="checkbox" checked={onBreak} onChange={(e) => setOnBreak(e.target.checked)} />
          </label>
        </SwapSheet>
      )}
      {match && menu && (
        <Sheet title={`Court ${court}`} onClose={() => setMenu(false)}>
          <div className="stack">
            <p className="muted">To swap one player, close this and tap their name on the court.</p>
            <div className="stack" style={{ gap: 8 }}>
              <button
                type="button"
                className="btn btn-block"
                disabled={busy}
                onClick={async () => {
                  if (await act(`/matches/${match.id}/unstart`, undefined, "Moved back to Up Next")) setMenu(false);
                }}
              >
                <Icon name="undo" /> Move back to Up Next
              </button>
              <p className="muted small">
                Frees the court and makes these 4 Up Next again{nextId ? ". The current Up Next goes back to waiting" : ""}.
              </p>
            </div>
            <div className="stack" style={{ gap: 8 }}>
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
              <p className="muted small">No result. All 4 go back to the front of the line in their old places.</p>
            </div>
          </div>
        </Sheet>
      )}
    </CourtCard>
  );
}

/** Records a result for a game on court, or with `edit`, fixes a finished game's winner or score. */
function ResultSheet({
  match,
  winner: initial,
  edit = false,
  onClose,
  act,
  busy,
}: {
  match: MatchView;
  winner: 1 | 2;
  edit?: boolean;
  onClose: () => void;
  act: Act;
  busy: boolean;
}) {
  const [winner, setWinner] = useState<1 | 2>(initial);
  // Editing: the saved score. Recording a game an umpire was scoring: their running score.
  const start = edit ? match : match.live?.rallies ? match.live : null;
  const [score1, setScore1] = useState(start ? String(start.score1 ?? "") : "");
  const [score2, setScore2] = useState(start ? String(start.score2 ?? "") : "");
  const toast = useToast();

  const s1 = score1 === "" ? null : Number(score1);
  const s2 = score2 === "" ? null : Number(score2);
  const bothScores = s1 !== null && s2 !== null;
  const scoreWinner: 1 | 2 | null = bothScores && s1 !== s2 ? (s1! > s2! ? 1 : 2) : null;
  // Checked while typing, so a misclick shows up before anything is saved.
  const problem: { text: string; fix?: 1 | 2 } | null =
    (s1 === null) !== (s2 === null)
      ? { text: "Enter both scores, or leave both empty." }
      : bothScores && s1 === s2
        ? { text: "The scores are tied. Pickleball games can't end in a tie, so check the score." }
        : scoreWinner && scoreWinner !== winner
          ? {
              text: `The score says ${names(scoreWinner === 1 ? match.team1 : match.team2)} won, but you picked ${names(winner === 1 ? match.team1 : match.team2)}.`,
              fix: scoreWinner,
            }
          : null;
  // Only show "enter both" after they've moved on from the first box.
  const [touched, setTouched] = useState(false);
  const visible = problem && (problem.fix || bothScores || touched) ? problem : null;
  const unchanged = edit && winner === match.winner && s1 === match.score1 && s2 === match.score2;

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (problem || unchanged) return;
    if (edit) {
      if (await act(`/matches/${match.id}/result`, { winner, score1: s1, score2: s2 }, "Result updated", "PATCH")) onClose();
      return;
    }
    const ok = await act(`/matches/${match.id}/result`, { winner, score1: s1, score2: s2 });
    if (ok) {
      onClose();
      toast(`Saved: ${names(winner === 1 ? match.team1 : match.team2)} won`, {
        label: "Undo",
        run: () => void act(`/matches/${match.id}/undo`, undefined, `Court ${match.court} is back on`),
      });
    }
  };

  const scoreInput = (id: string, label: string, value: string, set: (v: string) => void) => (
    <div className="field">
      <label htmlFor={id} className="small">
        {label}
      </label>
      <input
        id={id}
        className={`input ${visible ? "input-invalid" : ""}`}
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={2}
        enterKeyHint="next"
        value={value}
        onChange={(e) => set(e.target.value.replace(/\D/g, ""))}
        onBlur={() => setTouched(true)}
        placeholder="–"
        aria-invalid={visible ? true : undefined}
        aria-describedby={visible ? "score-problem" : undefined}
      />
    </div>
  );

  return (
    <Sheet title={edit ? `Edit Court ${match.court} result` : `Court ${match.court} result`} onClose={onClose}>
      <form className="stack" onSubmit={save} noValidate>
        <div className="winner-pick" role="group" aria-label="Winning team">
          <button type="button" className="pick" aria-pressed={winner === 1} onClick={() => setWinner(1)}>
            {winner === 1 && <Icon name="check" />}
            {names(match.team1)}
          </button>
          <button type="button" className="pick" aria-pressed={winner === 2} onClick={() => setWinner(2)}>
            {winner === 2 && <Icon name="check" />}
            {names(match.team2)}
          </button>
        </div>
        <div className="score-entry">
          {scoreInput("s1", names(match.team1), score1, setScore1)}
          <span className="upnext-vs" style={{ paddingBottom: 16 }}>
            to
          </span>
          {scoreInput("s2", names(match.team2), score2, setScore2)}
        </div>
        {visible ? (
          <div className="alert" role="alert" id="score-problem">
            <p>{visible.text}</p>
            {visible.fix && (
              <button type="button" className="btn btn-sm btn-danger-solid" onClick={() => setWinner(visible.fix!)}>
                Change winner to {names(visible.fix === 1 ? match.team1 : match.team2)}
              </button>
            )}
          </div>
        ) : edit ? (
          <p className="muted small">Standings update right away. The line and the courts stay as they are.</p>
        ) : (
          <p className="muted small">The score is optional. It's used for point difference in the standings.</p>
        )}
        <button type="submit" className="btn btn-primary btn-block" disabled={busy || !!visible || unchanged}>
          {edit ? "Save changes" : "Save result"}
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

      {picked && <PlayerActions attendance={picked} umpires={state.umpires ?? []} act={act} onClose={() => setPicked(null)} />}
    </section>
  );
}

function PlayerActions({
  attendance,
  umpires,
  act,
  onClose,
}: {
  attendance: Attendance;
  umpires: UmpireInfo[];
  act: Act;
  onClose: () => void;
}) {
  const p = attendance.player;
  const umpire = umpires.find((u) => u.playerId === p.id);
  const [showLink, setShowLink] = useState(false);
  const [offLine, setOffLine] = useState(attendance.status === "in");
  const run = async (status: "in" | "break" | "left", done: string) => {
    if (await act(`/players/${p.id}/status`, { status }, done)) onClose();
  };
  const makeUmpire = async () => {
    if (await act("/umpires", { playerId: p.id, onBreak: offLine }, `${p.name} is an umpire`)) setShowLink(true);
  };

  if (showLink && umpire) {
    return (
      <Sheet title={`${p.name} is umpiring`} onClose={onClose}>
        <UmpireLinkView umpire={umpire} />
      </Sheet>
    );
  }
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
      <hr style={{ border: 0, borderTop: "1px solid var(--line)", width: "100%" }} />
      {umpire ? (
        <div className="stack" style={{ gap: 8 }}>
          <p className="small">
            <b>{p.name} is an umpire.</b> Their link scores games only.
          </p>
          <div className="row row-wrap">
            <button type="button" className="btn btn-sm" onClick={() => setShowLink(true)}>
              <Icon name="qr" /> Show umpire link
            </button>
            <button type="button" className="btn btn-sm btn-ghost btn-danger" onClick={() => act(`/umpires/${umpire.id}`, undefined, `${p.name} stopped umpiring`, "DELETE")}>
              Stop umpiring
            </button>
          </div>
        </div>
      ) : (
        <div className="stack" style={{ gap: 8 }}>
          <button type="button" className="btn btn-block" onClick={makeUmpire}>
            Make {p.name} an umpire
          </button>
          {attendance.status === "in" && (
            <label className="switch">
              <span className="small">Also take them out of the line (on break)</span>
              <input type="checkbox" checked={offLine} onChange={(e) => setOffLine(e.target.checked)} />
            </label>
          )}
          <p className="muted small">Umpires score games point by point from their phone. They can't change the line.</p>
        </div>
      )}
    </Sheet>
  );
}

/** The umpire's personal link: scan it from the organizer's phone, or send it. */
function UmpireLinkView({ umpire }: { umpire: UmpireInfo }) {
  const toast = useToast();
  const url = `${location.origin}/ump/${umpire.token}`;
  const send = async () => {
    const result = await shareText("Umpire link", `${umpire.name}, you're umpiring today. Open this to score games:`, url);
    if (result === "copied") toast("Umpire link copied. Send it to them.");
    if (result === "failed") toast(url);
  };
  return (
    <div className="stack">
      <QrCode text={url} label={`Umpire link for ${umpire.name}`} />
      <p className="muted">
        Ask {umpire.name} to scan this with their phone camera. The link only scores games: it can't start games, swap players or
        change the line.
      </p>
      <button type="button" className="btn btn-primary btn-block" onClick={send}>
        <Icon name="share" /> Send the link instead
      </button>
    </div>
  );
}

/** Session settings: the umpires list, and adding a guest umpire by name. */
function Umpires({ state, act, busy }: { state: SessionState; act: Act; busy: boolean }) {
  const umpires = state.umpires ?? [];
  const [showing, setShowing] = useState<UmpireInfo | null>(null);
  const [name, setName] = useState("");
  const add = async (e: FormEvent) => {
    e.preventDefault();
    if (await act("/umpires", { name: name.trim() }, `${name.trim()} is an umpire`)) setName("");
  };
  if (showing) {
    return (
      <div className="stack">
        <button type="button" className="btn btn-ghost btn-sm back-btn" onClick={() => setShowing(null)}>
          <Icon name="back" /> Umpires
        </button>
        <UmpireLinkView umpire={showing} />
      </div>
    );
  }
  return (
    <div className="stack" style={{ gap: 10 }}>
      <div>
        <span style={{ fontWeight: 650 }}>Umpires</span>
        <p className="muted small">They score games from their phone, point by point. To make a player an umpire, tap their name in Check in or Line.</p>
      </div>
      {umpires.length > 0 && (
        <ul className="pick-list">
          {umpires.map((u) => (
            <li key={u.id} className="pick-row">
              <span className="pick" style={{ cursor: "default" }}>
                {u.name}
              </span>
              <button type="button" className="btn btn-sm" onClick={() => setShowing(u)}>
                Link
              </button>
              <button
                type="button"
                className="icon-btn"
                aria-label={`Stop ${u.name} umpiring`}
                title="Remove"
                onClick={() => act(`/umpires/${u.id}`, undefined, `${u.name} stopped umpiring`, "DELETE")}
              >
                <Icon name="close" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <form className="row" onSubmit={add}>
        <input
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Guest umpire's name"
          aria-label="Guest umpire's name"
          maxLength={40}
        />
        <button type="submit" className="btn" disabled={busy || !name.trim()}>
          Add
        </button>
      </form>
    </div>
  );
}

// ---------- Check in ----------

function CheckIn({ state, act }: { state: SessionState; act: Act }) {
  const { data: roster } = useApi<RosterPlayer[]>("/api/players");
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Attendance | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const status = new Map(state.attendance.map((a) => [a.player.id, a]));
  const busyIds = new Set(
    [...state.courts.flatMap((c) => (c.match ? [...c.match.team1, ...c.match.team2] : [])), ...(state.next ? [...state.next.team1, ...state.next.team2] : [])].map((p) => p.id),
  );
  const q = query.trim().toLowerCase();
  const list = (roster ?? []).filter((p) => !q || p.name.toLowerCase().includes(q));
  const notHere = list.filter((p) => !status.has(p.id) || status.get(p.id)!.status === "left");
  const here = list.filter((p) => status.has(p.id) && status.get(p.id)!.status !== "left");
  const exact = (roster ?? []).some((p) => p.name.toLowerCase() === q);
  // Drop anyone who got checked in since they were ticked.
  const chosen = notHere.filter((p) => selected.has(p.id));
  const allTicked = notHere.length > 0 && chosen.length === notHere.length;
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const checkInSelected = async () => {
    setBulkBusy(true);
    const ok = await act("/checkin/bulk", { playerIds: chosen.map((p) => p.id) }, `${plural(chosen.length, "player")} checked in`);
    if (ok) setSelected(new Set());
    setBulkBusy(false);
  };

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
      {state.coming.length > 0 && (
        <div className="panel panel-tight">
          <div className="section-head" style={{ padding: "8px 8px 0" }}>
            <h2>Coming</h2>
            <span className="muted small">{state.coming.length}</span>
          </div>
          <p className="muted small" style={{ padding: "0 8px 8px" }}>
            Said they're on the way from the group chat. Tap Here when they arrive and they join the back of the line.
          </p>
          <ul className="pick-list">
            {state.coming.map((p) => (
              <li key={p.id} className="pick-row">
                <span className="pick" style={{ cursor: "default" }}>
                  {p.name}
                  {p.isGuest && <span className="pill pill-guest">Guest</span>}
                </span>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => act("/checkin", { playerId: p.id }, `${p.name} is in line`)}>
                  Here
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={`Remove ${p.name} from Coming`}
                  title="Remove"
                  onClick={() => act(`/rsvps/${p.id}`, undefined, `${p.name} removed from Coming`, "DELETE")}
                >
                  <Icon name="close" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
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
          {notHere.length > 1 ? (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setSelected(allTicked ? new Set() : new Set(notHere.map((p) => p.id)))}
            >
              {allTicked ? "Clear" : `Select all ${notHere.length}`}
            </button>
          ) : (
            <span className="muted small">{notHere.length}</span>
          )}
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
              <label className="tick">
                <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} aria-label={`Select ${p.name}`} />
              </label>
              <span className="line-main" onClick={() => toggle(p.id)}>
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

      {chosen.length > 0 && (
        <div className="bulk-bar">
          <button type="button" className="btn btn-primary btn-block" disabled={bulkBusy} onClick={checkInSelected}>
            {bulkBusy ? "Checking in…" : `Check in ${plural(chosen.length, "player")}`}
          </button>
        </div>
      )}

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
      {picked && <PlayerActions attendance={picked} umpires={state.umpires ?? []} act={act} onClose={() => setPicked(null)} />}
    </section>
  );
}

// ---------- Ended ----------

function EndedSession({ state, onEdit }: { state: SessionState; onEdit: (m: MatchView) => void }) {
  const s = state.session;
  const toast = useToast();
  const share = async () => {
    const result = await shareText(s.title, standingsText(state.teamName, s.title, state.stats, state.standings));
    if (result === "copied") toast("Standings copied. Paste them in your group chat.");
    if (result === "failed") toast("Couldn't copy. Take a screenshot instead.");
  };
  return (
    <div className="page">
      <header className="session-head">
        <button type="button" className="btn btn-ghost btn-sm back-btn" onClick={() => goBack("/app/club?tab=sessions")}>
          <Icon name="back" /> Back
        </button>
        <span className="row">
          <span className="pill">Session complete</span>
          {s.venue && <span className="muted">{s.venue}</span>}
        </span>
        <h1>{s.title}</h1>
      </header>
      <SessionSummary stats={state.stats} />
      {state.standings.length > 0 && (
        <section className="panel">
          <div className="section-head">
            <h2>Final standings</h2>
            <button type="button" className="btn btn-sm" onClick={share}>
              <Icon name="share" /> Share
            </button>
          </div>
          <Podium standings={state.standings} />
          <Standings standings={state.standings} detail={{ results: state.results, teamName: state.teamName, title: s.title }} />
        </section>
      )}
      <section className="panel">
        <div className="section-head">
          <h2>Games</h2>
        </div>
        <GameLog results={state.results} onEdit={onEdit} />
      </section>
      <Link to="/app/sessions" className="btn">
        Start another session
      </Link>
    </div>
  );
}
