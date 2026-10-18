import { type CSSProperties, useEffect, useState } from "react";
import type { Player } from "../../shared/types";
import { Brand } from "../components/Brand";
import { CourtDiagram } from "../components/Court";
import { DotGrid } from "../components/DotGrid";
import { Icon, type IconName } from "../components/Icon";
import { PickleCursor } from "../components/PickleCursor";
import { PlayerMascot } from "../components/PlayerMascot";
import { ThemeToggle } from "../components/ThemeToggle";
import { CONTACT_EMAIL, FAQ } from "../content/site";
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

/** Every plan is free; the pricing section says so with a straight face. Features must stay true. */
const PLANS: { name: string; who: string; note: string; features: string[]; cta?: string; featured?: boolean }[] = [
  {
    name: "Player",
    who: "Everyone in the line.",
    note: "No account. No app. No catch.",
    features: [
      "Live courts, Up Next and your place in line",
      "A buzz on your phone when you're up",
      "I'm coming from the group chat, QR check-in at the court",
      "Standings and your own stats after every game",
    ],
  },
  {
    name: "Organizer",
    who: "The one running the courts.",
    note: "Still zero. We checked.",
    features: [
      "Up Next always ready, all four off after each game",
      "Balanced, social, skill groups or winners vs winners",
      "Bulk check-in, results with scores, Undo",
      "Session summary with podium, ready to share",
    ],
    cta: "Create your team",
    featured: true,
  },
  {
    name: "Club",
    who: "Your whole crew, every week.",
    note: "There's no billing page to find.",
    features: [
      "Umpires scoring rally by rally on their phones",
      "Leaderboards for the month, all time and each place",
      "More organizers, saved places, your own court colors",
      "No ads, and your players' data is never sold",
    ],
    cta: "Create your team",
  },
];

const TERMS = [12, 6, 3, 1];

const SHOTS: { file: string; title: string; text: string }[] = [
  { file: "court", title: "Run the courts", text: "Up Next is always ready. Start it on a free court, then tap who won." },
  { file: "live", title: "Players follow along", text: "Courts, the line and standings on every phone, with a buzz when they're up." },
  { file: "ump", title: "Umpires score live", text: "Rally by rally with side-out calls. The score shows everywhere at once." },
];

/** Fades elements marked .reveal up as they scroll into view, once. Shown at once for reduced motion. */
/** Three plans, one price. The billing switch works; the total never changes. */
function Pricing() {
  const [months, setMonths] = useState(12);
  return (
    <section className="landing-section" aria-labelledby="pricing-title">
      <div className="landing-head">
        <h2 id="pricing-title">Pricing</h2>
        <p>Pick a plan. Take your time, they all cost the same.</p>
        <div className="terms" role="radiogroup" aria-label="Billing period">
          {TERMS.map((m) => (
            <button key={m} type="button" role="radio" aria-checked={months === m} onClick={() => setMonths(m)}>
              {m} mo
              <span>save 0%</span>
            </button>
          ))}
        </div>
      </div>
      <div className="plans">
        {PLANS.map((plan, i) => (
          <article key={plan.name} className={`plan reveal${plan.featured ? " is-featured" : ""}`} style={{ "--i": i } as CSSProperties}>
            <div className="plan-head">
              <h3>{plan.name}</h3>
              {plan.featured && <span className="pill">Most popular</span>}
            </div>
            <p className="plan-who">{plan.who}</p>
            <p className="plan-price">
              <b>₱0</b>
              <span>/ forever</span>
            </p>
            <p className="plan-bill">
              Billed ₱0 every {months === 1 ? "month" : `${months} months`}. {plan.note}
            </p>
            <ul>
              {plan.features.map((f) => (
                <li key={f}>
                  <Icon name="check" />
                  {f}
                </li>
              ))}
            </ul>
            {plan.cta ? (
              <Link to="/register" className={`btn btn-block ${plan.featured ? "btn-primary" : ""}`}>
                {plan.cta}
              </Link>
            ) : (
              <p className="plan-none">Nothing to sign up for. Just tap the link.</p>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

/** Footer for the public pages. */
export function SiteFooter() {
  return (
    <footer className="footer">
      <div className="wrap footer-inner">
        <span>NEXA, the open-play queue for pickleball clubs.</span>
        <nav className="footer-links" aria-label="Site">
          <Link to="/login">Organizer log in</Link>
          <Link to="/terms">Terms</Link>
          <Link to="/privacy">Privacy</Link>
          {CONTACT_EMAIL && <a href={`mailto:${CONTACT_EMAIL}`}>Contact</a>}
        </nav>
      </div>
    </footer>
  );
}

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
      <DotGrid />
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
            <PlayerMascot />
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

        <section className="landing-section" aria-labelledby="shots-title">
          <div className="landing-head">
            <h2 id="shots-title">See NEXA in action</h2>
            <p>One screen for organizers. A live view for players. A scorepad for umpires.</p>
            <p className="small hide-wide">Swipe to see all three.</p>
          </div>
          <div className="shots">
            {SHOTS.map((s, i) => (
              <figure key={s.file} className="shot reveal" style={{ "--i": i } as CSSProperties}>
                <div className="shot-frame">
                  {(["light", "dark"] as const).map((theme) => (
                    <img
                      key={theme}
                      className={`for-${theme}`}
                      src={`/assets/img/shots/${s.file}-${theme}.webp`}
                      alt={`${s.title}: NEXA on a phone`}
                      width={390}
                      height={844}
                      loading="lazy"
                      decoding="async"
                    />
                  ))}
                </div>
                <figcaption>
                  <b>
                    {i + 1}. {s.title}
                  </b>
                  <span>{s.text}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>

        <Pricing />

        <section className="landing-section faq" aria-labelledby="faq-title">
          <div className="landing-head">
            <h2 id="faq-title">Questions</h2>
          </div>
          <div className="faq-list">
            {FAQ.map((f) => (
              <details key={f.q}>
                <summary>
                  {f.q}
                  <Icon name="chevron" />
                </summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="cta">
          <h2>Less queue-keeping. More pickleball.</h2>
          <p>Free for your club. Set up in a minute, add players as they arrive.</p>
          <Link to="/register" className="btn btn-primary">
            Create your team
          </Link>
        </section>
      </main>
      <SiteFooter />
      <PickleCursor />
    </>
  );
}
