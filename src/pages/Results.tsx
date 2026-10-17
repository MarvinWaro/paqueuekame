import { useState } from "react";
import { decidingRule } from "../../shared/standings";
import type { MatchView, SessionStats, Standing } from "../../shared/types";
import { Icon } from "../components/Icon";
import { Sheet } from "../components/Sheet";
import { useToast } from "../components/Toast";
import { names, timeLabel } from "../lib/format";
import { shareText } from "../lib/share";

const MEDALS = ["gold", "silver", "bronze"] as const;
const pct = (x: number) => `${Math.round(x * 100)}%`;
const diff = (n: number) => (n > 0 ? `+${n}` : String(n));

export function Medal({ rank }: { rank: number }) {
  const medal = MEDALS[rank - 1];
  return (
    <span className={`medal ${medal ? `medal-${medal}` : ""}`} aria-label={medal ? `${medal} medal, rank ${rank}` : `Rank ${rank}`}>
      {rank}
    </span>
  );
}

/** What a player's stats sheet needs besides the standings. */
export interface StandingsDetail {
  results: MatchView[];
  teamName: string;
  title: string;
}

/**
 * Ranked list. Ties: wins, then win rate, then opponent strength, then point difference (shared/standings.ts).
 * With `detail`, tapping a player opens their stats.
 */
export function Standings({
  standings,
  youId,
  limit,
  detail,
}: {
  standings: Standing[];
  youId?: string | null;
  limit?: number;
  detail?: StandingsDetail;
}) {
  // By id, not position: a new result can reorder the list while the sheet is open.
  const [openId, setOpenId] = useState<string | null>(null);
  if (standings.length === 0) return <p className="muted">Standings appear after the first result.</p>;
  const tied = standings.some((s, i) => i > 0 && standings[i - 1].wins === s.wins);
  return (
    <>
      <ol className="standings">
        {standings.slice(0, limit).map((s, i) => {
          const rank = i + 1;
          const className = `standing ${rank <= 3 ? "is-podium" : ""} ${s.player.id === youId ? "is-you" : ""}`;
          const row = (
            <>
              <Medal rank={rank} />
              <span className="standing-main">
                <span className="standing-name">{s.player.name}</span>
                <span className="standing-meta">
                  {pct(s.winRate)} win rate, {s.games} {s.games === 1 ? "game" : "games"}, {s.wins}–{s.losses}
                  {s.pointDiff !== 0 ? `, ${diff(s.pointDiff)} pts` : ""}
                </span>
                <span className="standing-meta" title="Average win rate of the opponents they played. Higher means tougher games.">
                  Opponent strength {pct(s.oppStrength)}
                </span>
              </span>
              <span className="standing-wins">
                <b>{s.wins}</b>
                {s.wins === 1 ? "win" : "wins"}
              </span>
              {detail && <Icon name="chevron" className="icon standing-chevron" />}
            </>
          );
          return (
            <li key={s.player.id}>
              {detail ? (
                <button type="button" className={className} onClick={() => setOpenId(s.player.id)}>
                  {row}
                </button>
              ) : (
                <div className={className}>{row}</div>
              )}
            </li>
          );
        })}
      </ol>
      <TieNote tied={tied} />
      {detail && openId && <PlayerSheet standings={standings} playerId={openId} detail={detail} onClose={() => setOpenId(null)} />}
    </>
  );
}

/** One player's session: rank, record, why they're placed there, and their games. */
function PlayerSheet({
  standings,
  playerId,
  detail,
  onClose,
}: {
  standings: Standing[];
  playerId: string;
  detail: StandingsDetail;
  onClose: () => void;
}) {
  const toast = useToast();
  const index = standings.findIndex((s) => s.player.id === playerId);
  const s = standings[index];
  if (!s) return null;
  const rank = index + 1;
  const games = detail.results.filter((m) => sideOf(m, playerId));
  const scored = games.some((m) => m.score1 != null);

  const share = async () => {
    const lines = [
      `${s.player.name}: #${rank} of ${standings.length} at ${detail.teamName} (${detail.title})`,
      `${s.wins} ${s.wins === 1 ? "win" : "wins"}, ${s.losses} ${s.losses === 1 ? "loss" : "losses"} (${pct(s.winRate)} win rate)`,
      `Opponent strength ${pct(s.oppStrength)}${scored ? `, ${diff(s.pointDiff)} pts` : ""}`,
    ];
    const result = await shareText(`${s.player.name}'s stats`, lines.join("\n"));
    if (result === "copied") toast("Stats copied. Paste them in your group chat.");
    if (result === "failed") toast("Couldn't copy. Take a screenshot instead.");
  };

  return (
    <Sheet title={s.player.name} onClose={onClose}>
      <div className="stack player-card">
        <div className="pc-head">
          <Medal rank={rank} />
          <span className="pc-rank">
            <b>
              #{rank} of {standings.length}
            </b>
            <span className="muted small">{detail.title}</span>
          </span>
          <button type="button" className="btn btn-sm" onClick={share}>
            <Icon name="share" /> Share
          </button>
        </div>

        <div className="pc-tiles">
          <div>
            <b className="num">
              {s.wins}–{s.losses}
            </b>
            <span>won–lost</span>
          </div>
          <div>
            <b className="num">{pct(s.winRate)}</b>
            <span>win rate</span>
          </div>
          <div>
            <b className="num">{pct(s.oppStrength)}</b>
            <span>opponent strength</span>
          </div>
          {scored && (
            <div>
              <b className="num">{diff(s.pointDiff)}</b>
              <span>points</span>
            </div>
          )}
        </div>

        <section className="pc-why">
          <h3>Why #{rank}?</h3>
          <ul>
            {rankReasons(standings, index).map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </section>

        <section>
          <h3>Games</h3>
          <ol className="pc-games">
            {games.map((m) => (
              <PlayerGame key={m.id} match={m} playerId={playerId} />
            ))}
          </ol>
          {games.length < s.games && (
            <p className="muted small">
              Showing the latest {games.length} of {s.games} games.
            </p>
          )}
        </section>
      </div>
    </Sheet>
  );
}

function sideOf(m: MatchView, playerId: string): 1 | 2 | null {
  if (m.team1.some((p) => p.id === playerId)) return 1;
  if (m.team2.some((p) => p.id === playerId)) return 2;
  return null;
}

function PlayerGame({ match: m, playerId }: { match: MatchView; playerId: string }) {
  const side = sideOf(m, playerId)!;
  const [mine, theirs] = side === 1 ? [m.team1, m.team2] : [m.team2, m.team1];
  const partners = mine.filter((p) => p.id !== playerId);
  const won = m.winner === side;
  const score = m.score1 != null && m.score2 != null ? (side === 1 ? `${m.score1}–${m.score2}` : `${m.score2}–${m.score1}`) : null;
  return (
    <li className="pc-game">
      <span className={`pc-result ${won ? "is-win" : ""}`} aria-label={won ? "Won" : "Lost"}>
        {won ? "W" : "L"}
      </span>
      <span className="pc-game-main">
        <span>
          {partners.length > 0 && <>with {names(partners)} </>}vs {names(theirs)}
        </span>
        <span className="muted small">
          Court {m.court}
          {m.endedAt ? `, ${timeLabel(m.endedAt)}` : ""}
        </span>
      </span>
      {score && <span className="pc-score num">{score}</span>}
    </li>
  );
}

/** Plain-English reasons for a rank: why the player above is ahead, and why this player is ahead of the next. */
function rankReasons(standings: Standing[], i: number): string[] {
  const [above, me, below] = [standings[i - 1], standings[i], standings[i + 1]];
  const reasons: string[] = [];
  if (above) reasons.push(aheadBecause(above, me));
  else reasons.push(below ? "Top of the standings." : "The only player with a result so far.");
  if (below) reasons.push(aheadBecause(me, below));
  return reasons;
}

function aheadBecause(a: Standing, b: Standing): string {
  const [A, B] = [a.player.name, b.player.name];
  const both = `${A} and ${B} both have ${a.wins} ${a.wins === 1 ? "win" : "wins"}`;
  switch (decidingRule(a, b)) {
    case "wins":
      return `${A} is ahead of ${B} with more wins (${a.wins} vs ${b.wins}).`;
    case "win rate":
      return `${both}; ${A} has the higher win rate (${pct(a.winRate)} vs ${pct(b.winRate)}).`;
    case "opponent strength": {
      const [x, y] = closePcts(a.oppStrength, b.oppStrength);
      return `${both} and the same win rate; ${A} faced tougher opponents (opponent strength ${x} vs ${y}).`;
    }
    case "point difference":
      return `${both}, the same win rate and opponent strength; ${A} has the bigger point difference (${diff(a.pointDiff)} vs ${diff(b.pointDiff)}).`;
    case "name":
      return `${A} and ${B} are tied on everything, so they're listed alphabetically.`;
  }
}

/** Two percentages that look the same when rounded get one decimal, so the difference shows. */
function closePcts(x: number, y: number): [string, string] {
  if (pct(x) !== pct(y)) return [pct(x), pct(y)];
  return [`${(x * 100).toFixed(1)}%`, `${(y * 100).toFixed(1)}%`];
}

/** Answers "why is she above me?" so the organizer doesn't have to. */
function TieNote({ tied }: { tied: boolean }) {
  return (
    <details className="tie-note">
      <summary>{tied ? "Same number of wins? Here's how the order is decided" : "How the ranking works"}</summary>
      <ol>
        <li>
          <b>Most wins</b> ranks first.
        </li>
        <li>
          Same wins? Higher <b>win rate</b> goes ahead. 5 wins from 6 games beats 5 wins from 8.
        </li>
        <li>
          Still tied? Higher <b>opponent strength</b>: whoever beat tougher players.
        </li>
        <li>
          Still tied? Bigger <b>point difference</b> (pts): points scored minus points allowed. Only games with a score count.
        </li>
      </ol>
    </details>
  );
}

/** Top three on steps: 2nd, 1st, 3rd. */
export function Podium({ standings }: { standings: Standing[] }) {
  const top = standings.slice(0, 3);
  if (top.length === 0) return null;
  const order = [top[1], top[0], top[2]];
  return (
    <div className="podium" role="list" aria-label="Top three">
      {order.map((s, i) =>
        s ? (
          <div key={s.player.id} role="listitem" className={`step step-${[2, 1, 3][i]}`}>
            <span className="step-name">{s.player.name}</span>
            <span className="step-record">
              {s.wins}–{s.losses}
            </span>
            <span className="step-block">
              <Medal rank={[2, 1, 3][i]} />
            </span>
          </div>
        ) : (
          <div key={i} className="step step-empty" aria-hidden="true" />
        ),
      )}
    </div>
  );
}

function clockText(seconds: number | null): string {
  if (seconds == null) return "–";
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function SessionSummary({ stats }: { stats: SessionStats }) {
  return (
    <section className="summary">
      <div className="summary-tiles">
        <div>
          <b>{stats.games}</b>
          <span>{stats.games === 1 ? "game" : "games"}</span>
        </div>
        <div>
          <b>{stats.minutes}</b>
          <span>minutes</span>
        </div>
        <div>
          <b>{stats.courts}</b>
          <span>{stats.courts === 1 ? "court" : "courts"}</span>
        </div>
        <div>
          <b>{stats.players}</b>
          <span>players</span>
        </div>
      </div>
      {stats.timedGames > 0 && (
        <p className="summary-pace">
          Games took <b className="num">{clockText(stats.avgGameSeconds)}</b> on average, and players waited{" "}
          <b className="num">{clockText(stats.avgWaitSeconds)}</b> in line between games.
        </p>
      )}
    </section>
  );
}

/** Plain text for the group chat. */
export function standingsText(teamName: string, title: string, stats: SessionStats, standings: Standing[]): string {
  const icons = ["🥇", "🥈", "🥉"];
  const lines = standings
    .slice(0, 10)
    .map((s, i) => `${icons[i] ?? `${i + 1}.`} ${s.player.name}: ${s.wins}W ${s.losses}L (${pct(s.winRate)})`);
  return [`${teamName}: ${title}`, `${stats.games} games, ${stats.minutes} minutes`, "", ...lines].join("\n");
}

/** Finished games. onUndo shows Undo on the latest game; onEdit shows Edit on every game. */
export function GameLog({
  results,
  onUndo,
  onEdit,
}: {
  results: MatchView[];
  onUndo?: (m: MatchView) => void;
  onEdit?: (m: MatchView) => void;
}) {
  if (results.length === 0) return <p className="muted">Finished games show up here.</p>;
  return (
    <ol className="game-log">
      {results.map((m, i) => (
        <li key={m.id} className="game">
          <span className={`game-team ${m.winner === 1 ? "won" : ""}`}>{names(m.team1)}</span>
          <span className="game-score num" aria-label={m.score1 != null ? `${m.score1} to ${m.score2}` : m.winner === 1 ? "won by first team" : "won by second team"}>
            {m.score1 != null ? `${m.score1}–${m.score2}` : m.winner === 1 ? "W – L" : "L – W"}
          </span>
          <span className={`game-team ${m.winner === 2 ? "won" : ""}`}>{names(m.team2)}</span>
          <span className="game-foot">
            <span>
              Court {m.court}
              {m.endedAt ? `, ${timeLabel(m.endedAt)}` : ""}
            </span>
            {(onEdit || (onUndo && i === 0)) && (
              <span className="game-actions">
                {onUndo && i === 0 && (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => onUndo(m)}>
                    <Icon name="undo" /> Undo
                  </button>
                )}
                {onEdit && (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => onEdit(m)}>
                    <Icon name="edit" /> Edit
                  </button>
                )}
              </span>
            )}
          </span>
        </li>
      ))}
    </ol>
  );
}
