import type { ReactNode } from "react";
import type { LiveScore, MatchView, Player } from "../../shared/types";
import { courtOrder } from "../../shared/sideout";
import { clock, names } from "../lib/format";

interface DiagramProps {
  team1?: Player[];
  team2?: Player[];
  winner?: 1 | 2 | null;
  youId?: string | null;
  label?: string;
  serverId?: string | null; // marks who is serving while an umpire scores
  onPlayer?: (p: Player) => void; // makes each name a button (organizer swap, umpire corrections)
  playerLabel?: (p: Player) => string; // what a screen reader says for that button
}

/** A pickleball court seen from above: each player stands in a service box, the kitchen sits beside the net. */
export function CourtDiagram({
  team1 = [],
  team2 = [],
  winner = null,
  youId = null,
  label,
  serverId = null,
  onPlayer,
  playerLabel = (p) => `Swap ${p.name}`,
}: DiagramProps) {
  const free = team1.length === 0 && team2.length === 0;
  const box = (p: Player | undefined, side: 1 | 2) => {
    const className = `box ${winner === side ? "winner" : ""} ${p && p.id === youId ? "you" : ""} ${p && p.id === serverId ? "serving" : ""}`;
    return p && onPlayer ? (
      <button type="button" className={className} onClick={() => onPlayer(p)} aria-label={playerLabel(p)}>
        {p.name}
      </button>
    ) : (
      <div className={className}>{p?.name ?? ""}</div>
    );
  };
  const server = [...team1, ...team2].find((p) => p.id === serverId);
  const description = free
    ? (label ?? "Empty court")
    : `${team1.map((p) => p.name).join(" and ")} versus ${team2.map((p) => p.name).join(" and ")}${server ? `, ${server.name} serving` : ""}`;
  return (
    <div className={`diagram ${free ? "is-free" : ""}`} role={onPlayer ? "group" : "img"} aria-label={description}>
      <div className="half half-left">
        {box(team1[0], 1)}
        {box(team1[1], 1)}
      </div>
      <div className="kitchen" />
      <div className="net" />
      <div className="kitchen" />
      <div className="half half-right">
        {box(team2[0], 2)}
        {box(team2[1], 2)}
      </div>
    </div>
  );
}

interface CourtCardProps {
  court: number;
  match: MatchView | null;
  now: number;
  youId?: string | null;
  children?: ReactNode;
  menu?: ReactNode;
  onPlayer?: (p: Player) => void;
}

export function CourtCard({ court, match, now, youId, children, menu, onPlayer }: CourtCardProps) {
  // While an umpire scores, draw players where they actually stand (base player on the right when even).
  const placed = match?.live ? courtOrder(match.team1, match.team2, match.live.right1, match.live.right2) : match;
  return (
    <article className="court" aria-label={`Court ${court}`}>
      <div className="court-head">
        <span className="court-no">{court}</span>
        <span className="court-name">{match ? "Court" : "Court is free"}</span>
        {match?.startedAt && (
          <span className="court-clock" title="Time since the game started">
            {clock(match.startedAt, now)}
          </span>
        )}
        {menu}
      </div>
      <CourtDiagram
        team1={placed?.team1}
        team2={placed?.team2}
        youId={youId}
        label={`Court ${court} is free`}
        serverId={match?.live?.serverId}
        onPlayer={match ? onPlayer : undefined}
      />
      {match?.live && <LiveScoreLine match={match} live={match.live} />}
      {children}
    </article>
  );
}

/** The running score under a court an umpire is scoring. */
function LiveScoreLine({ match, live }: { match: MatchView; live: LiveScore }) {
  const server = [...match.team1, ...match.team2].find((p) => p.id === live.serverId);
  const winners = live.winner === 1 ? match.team1 : live.winner === 2 ? match.team2 : null;
  return (
    <p className="live-score" aria-live="polite">
      <b className="num">
        {live.score1}–{live.score2}
      </b>
      <span>
        {winners
          ? `${names(winners)} won. The umpire is saving it.`
          : `${live.call}${server ? `, ${server.name} serving` : ""}`}
      </span>
      {live.umpire && <span className="muted small">Umpire: {live.umpire}</span>}
    </p>
  );
}
