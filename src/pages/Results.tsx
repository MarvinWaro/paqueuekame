import type { MatchView, Standing } from "../../shared/types";
import { Icon } from "../components/Icon";
import { names, timeLabel } from "../lib/format";

export function Standings({ standings, youId }: { standings: Standing[]; youId?: string | null }) {
  if (standings.length === 0) return <p className="muted">Standings appear after the first result.</p>;
  return (
    <div className="table-scroll">
      <table className="table">
        <thead>
          <tr>
            <th scope="col">
              <span className="sr-only">Rank</span>
            </th>
            <th scope="col">Player</th>
            <th scope="col" className="n">
              Won
            </th>
            <th scope="col" className="n">
              Lost
            </th>
            <th scope="col" className="n" title="Point difference, from games with a score">
              +/–
            </th>
          </tr>
        </thead>
        <tbody>
          {standings.map((s, i) => (
            <tr key={s.player.id} style={s.player.id === youId ? { background: "color-mix(in srgb, var(--ball) 30%, transparent)" } : undefined}>
              <td className="rank">{i + 1}</td>
              <td style={{ fontWeight: 650 }}>{s.player.name}</td>
              <td className="n">{s.wins}</td>
              <td className="n">{s.losses}</td>
              <td className="n">{s.pointDiff > 0 ? `+${s.pointDiff}` : s.pointDiff}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function GameLog({ results, onUndo }: { results: MatchView[]; onUndo?: (m: MatchView) => void }) {
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
            {onUndo && i === 0 && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => onUndo(m)}>
                <Icon name="undo" /> Undo
              </button>
            )}
          </span>
        </li>
      ))}
    </ol>
  );
}
