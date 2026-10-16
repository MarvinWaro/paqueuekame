import type { Player } from "../../shared/types";
import { Brand } from "../components/Brand";
import { CourtDiagram } from "../components/Court";
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

export function Landing() {
  return (
    <>
      <header className="topbar">
        <div className="wrap topbar-inner">
          <Brand />
          <ThemeToggle />
          <Link to="/login" className="btn btn-ghost btn-sm">
            Log in
          </Link>
        </div>
      </header>
      <main className="wrap">
        <section className="hero">
          <div className="hero-copy">
            <h1>No more paddle stack.</h1>
            <p>
              PaQueueKame runs open play for your team: who's on which court, who's up next, and how long until you play. Everyone
              follows along on their phone.
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
                <span className="small">Court 3 is almost done</span>
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
                    <b>About {wait}</b>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="points">
          <div className="point">
            <h3>A fair line</h3>
            <p>Whoever waited longest plays next. After each game all four go to the back, and partners change so nobody gets stuck together.</p>
          </div>
          <div className="point">
            <h3>Everyone can see it</h3>
            <p>Share one link in the group chat. Players check in with the QR code at the court and get an alert when they're up.</p>
          </div>
          <div className="point">
            <h3>Free for your team</h3>
            <p>No app to install and no player accounts. Organizers log in; everyone else just taps their name.</p>
          </div>
        </section>
      </main>
      <footer className="footer">
        <div className="wrap">PaQueueKame, an open-play queue for pickleball teams.</div>
      </footer>
    </>
  );
}
