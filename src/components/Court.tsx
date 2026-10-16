import type { ReactNode } from "react";
import type { MatchView, Player } from "../../shared/types";
import { clock } from "../lib/format";

interface DiagramProps {
  team1?: Player[];
  team2?: Player[];
  winner?: 1 | 2 | null;
  youId?: string | null;
  label?: string;
}

/** A pickleball court seen from above: each player stands in a service box, the kitchen sits beside the net. */
export function CourtDiagram({ team1 = [], team2 = [], winner = null, youId = null, label }: DiagramProps) {
  const free = team1.length === 0 && team2.length === 0;
  const box = (p: Player | undefined, side: 1 | 2) => (
    <div className={`box ${winner === side ? "winner" : ""} ${p && p.id === youId ? "you" : ""}`}>{p?.name ?? ""}</div>
  );
  const description = free
    ? (label ?? "Empty court")
    : `${team1.map((p) => p.name).join(" and ")} versus ${team2.map((p) => p.name).join(" and ")}`;
  return (
    <div className={`diagram ${free ? "is-free" : ""}`} role="img" aria-label={description}>
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
}

export function CourtCard({ court, match, now, youId, children, menu }: CourtCardProps) {
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
      <CourtDiagram team1={match?.team1} team2={match?.team2} youId={youId} label={`Court ${court} is free`} />
      {children}
    </article>
  );
}
