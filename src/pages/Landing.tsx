import { type CSSProperties, useEffect } from "react";
import type { Player } from "../../shared/types";
import { Brand } from "../components/Brand";
import { CourtDiagram } from "../components/Court";
import { Icon, type IconName } from "../components/Icon";
import { ThemeToggle } from "../components/ThemeToggle";
import { Link } from "../lib/router";

const p = (id: string, name: string): Player => ({ id, name, skill: null, isGuest: false });
const DEMO = {
  court1: [
    [p("1", "Juan"), p("2", "Ana")],
    [p("3", "Mark"), p("4", "Liza")],
  ],
  court2: [
    [p("5", "Paolo"), p("6", "Bea")],
    [p("7", "Migs"), p("8", "Kat")],
  ],
  next: ["Joy", "Rico", "Dan", "Mae"],
  line: [
    ["Tess", "8 min"],
    ["Ben", "8 min"],
    ["Carla", "11 min"],
  ],
};

const POINTS: { icon: IconName; title: string; text: string }[] = [
  {
    icon: "shuffle",
    title: "A fair line",
    text: "Whoever waited longest plays next. After each game all four go to the back, and partners change so nobody gets stuck together.",
  },
  {
    icon: "people",
    title: "Live on every phone",
    text: "Post one link in the group chat. Players see the courts, who's up next and their place in line, and get a buzz when it's their turn.",
  },
  {
    icon: "qr",
    title: "Check in at the court",
    text: "Members tap I'm coming from the chat, then scan the QR when they arrive. Nobody holds a spot from home.",
  },
  {
    icon: "check",
    title: "Umpires score live",
    text: "Hand a court to an umpire. They score rally by rally with side-out calls, and everyone sees 4-2-1 as it happens.",
  },
  {
    icon: "trophy",
    title: "A club with a memory",
    text: "Standings for every session, plus leaderboards for the month and all time, at every place you play.",
  },
  {
    icon: "gear",
    title: "Free for your club",
    text: "No app to install and no player accounts. Organizers log in; everyone else just taps their name.",
  },
];

/** Fades elements marked .reveal up as they scroll into view, once. Shown at once for reduced motion. */
function useReveal() {
  useEffect(() => {
    const items = document.querySelectorAll<HTMLElement>(".reveal");
    const show = (el: Element) => el.classList.add("is-in");
    if (!("IntersectionObserver" in window) || matchMedia("(prefers-reduced-motion: reduce)").matches) {
      items.forEach(show);
      return;
    }
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          show(e.target);
          io.unobserve(e.target);
        }),
      { rootMargin: "0px 0px -8% 0px", threshold: 0.15 },
    );
    items.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

export function Landing() {
  useReveal();
  return (
    <>
      <header className="topbar">
        <div className="wrap topbar-inner">
          <Brand />
          <ThemeToggle />
          <Link to="/login" className="btn btn-ghost btn-sm hide-narrow">
            Log in
          </Link>
          <Link to="/register" className="btn btn-primary btn-sm">
            Get started
          </Link>
        </div>
      </header>
      <main className="wrap">
        <section className="hero">
          <div className="hero-copy">
            <span className="hero-badge">
              <b>Free</b> For pickleball clubs that rent courts
            </span>
            <h1>
              Open play, <span className="shine">minus the paddle stack.</span>
            </h1>
            <p>
              NEXA runs the queue for your club: who's on which court, who's up next, and how long until you play. Everyone follows
              along on their phone.
            </p>
            <div className="row row-wrap">
              <Link to="/register" className="btn btn-primary">
                Create your team
              </Link>
              <Link to="/login" className="btn">
                Log in
              </Link>
            </div>
          </div>

          <div className="hero-demo" aria-label="Example of a live session">
            <div className="upnext">
              <div className="upnext-head">
                <h2>Up next</h2>
                <span className="small">Court 1 is almost done</span>
              </div>
              <div className="upnext-teams">
                <div className="upnext-team">
                  <span className="chip">{DEMO.next[0]}</span>
                  <span className="chip">{DEMO.next[1]}</span>
                </div>
                <span className="upnext-vs">vs</span>
                <div className="upnext-team">
                  <span className="chip">{DEMO.next[2]}</span>
                  <span className="chip">{DEMO.next[3]}</span>
                </div>
              </div>
            </div>
            <div className="courts">
              <article className="court">
                <div className="court-head">
                  <span className="court-no">1</span>
                  <span className="court-name">Court</span>
                  <span className="court-clock">9:41</span>
                </div>
                <CourtDiagram team1={DEMO.court1[0]} team2={DEMO.court1[1]} />
              </article>
              <article className="court">
                <div className="court-head">
                  <span className="court-no">2</span>
                  <span className="court-name">Court</span>
                  <span className="court-clock">4:12</span>
                </div>
                <CourtDiagram team1={DEMO.court2[0]} team2={DEMO.court2[1]} />
              </article>
            </div>
            <ol className="line-list panel panel-tight" start={1}>
              {DEMO.line.map(([name, wait], i) => (
                <li key={name} className="line-item">
                  <span className="line-pos">{i + 1}</span>
                  <span className="line-main">
                    <span className="line-name">
                      <span>{name}</span>
                    </span>
                  </span>
                  <span className="line-side">
                    <b>~{wait}</b>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="points" aria-label="What NEXA does">
          {POINTS.map((pt, i) => (
            <div key={pt.title} className="point reveal" style={{ "--i": i % 3 } as CSSProperties}>
              <Icon name={pt.icon} />
              <h3>{pt.title}</h3>
              <p>{pt.text}</p>
            </div>
          ))}
        </section>
      </main>
      <footer className="footer">
        <div className="wrap row spread row-wrap">
          <span>NEXA, the open-play queue for pickleball clubs.</span>
          <Link to="/login">Organizer log in</Link>
        </div>
      </footer>
    </>
  );
}
