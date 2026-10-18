import type { ReactNode } from "react";
import { Brand } from "../components/Brand";
import { DotGrid } from "../components/DotGrid";
import { PickleCursor } from "../components/PickleCursor";
import { ThemeToggle } from "../components/ThemeToggle";
import { CONTACT_EMAIL } from "../content/site";
import { Link } from "../lib/router";
import { SiteFooter } from "./Landing";

const UPDATED = "October 18, 2026";

function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <>
      <header className="topbar">
        <div className="wrap topbar-inner">
          <Brand />
          <ThemeToggle />
          <Link to="/" className="btn btn-ghost btn-sm">
            Home
          </Link>
        </div>
      </header>
      <main className="wrap">
        <article className="legal">
          <h1>{title}</h1>
          <p>Last updated {UPDATED}</p>
          {children}
        </article>
      </main>
      <SiteFooter />
      <DotGrid />
      <PickleCursor />
    </>
  );
}

function Contact() {
  return CONTACT_EMAIL ? (
    <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
  ) : (
    <>the organizer of your club, who can reach us</>
  );
}

export function Privacy() {
  return (
    <LegalPage title="Privacy">
      <p>
        NEXA runs open play for pickleball clubs. We keep only what that needs, we don't show ads, and we never sell or share
        your data.
      </p>

      <h2>What we keep</h2>
      <ul>
        <li>
          <strong>Organizers:</strong> name, email and password. Passwords are stored only as a secure hash; nobody can read
          them, including us.
        </li>
        <li>
          <strong>Clubs:</strong> the team name, court colors and the places you play.
        </li>
        <li>
          <strong>Players:</strong> the name or nickname the club enters, and an optional skill level. Players don't create
          accounts and we don't ask for their email or phone number.
        </li>
        <li>
          <strong>Games:</strong> sessions, check-ins, who played whom, winners and scores, and when each happened.
        </li>
      </ul>

      <h2>Who can see it</h2>
      <p>
        A session's live link shows the courts, the line and standings with players' names. Anyone the club shares that link
        with can open it, so clubs should share it with their members only. Everything else (the roster, past sessions,
        settings) is visible only to the club's organizers.
      </p>

      <h2>Cookies and storage</h2>
      <p>
        Organizers get one login cookie that keeps them signed in for 30 days. Your phone also remembers a few conveniences,
        such as light or dark mode, which player you are on a live link, and whether you've seen the tour. We use Cloudflare
        Web Analytics to count page views; it doesn't use cookies or track you across sites.
      </p>

      <h2>Where it's stored</h2>
      <p>
        NEXA runs on Cloudflare, which stores the data and serves the site. Connections are encrypted (HTTPS).
      </p>

      <h2>Keeping and deleting</h2>
      <p>
        Data stays while the club uses NEXA so standings and history keep working. Organizers can edit or archive players at
        any time. To delete a club and everything in it, or to ask what we hold about you, contact <Contact />.
      </p>

      <h2>Changes</h2>
      <p>If this page changes, the date at the top changes too.</p>
    </LegalPage>
  );
}

export function Terms() {
  return (
    <LegalPage title="Terms">
      <p>By using NEXA you agree to these terms. They're short on purpose.</p>

      <h2>The service</h2>
      <p>
        NEXA is a free tool for running open play: a queue, live courts, scoring and standings. We may change, add or remove
        features as it grows.
      </p>

      <h2>Organizers</h2>
      <ul>
        <li>Keep your password to yourself and give organizer access only to people you trust.</li>
        <li>Only add players who are happy to have their name shown to your club on the live link.</li>
        <li>You're responsible for what your club enters, such as names, places and results.</li>
      </ul>

      <h2>Fair use</h2>
      <p>
        Don't use NEXA to break the law, harass anyone, or overload or attack the service. NEXA runs on a free plan with daily
        limits, so we may limit or remove accounts that put it at risk for other clubs.
      </p>

      <h2>No guarantees</h2>
      <p>
        NEXA is provided as is. We work to keep it running and your data safe, but we can't promise it will always be
        available or error-free, and we're not liable for losses from using it, such as a court booking or a disputed
        result.
      </p>

      <h2>Ending</h2>
      <p>
        You can stop using NEXA at any time and ask us to delete your club (see <Link to="/privacy">Privacy</Link>). We may
        end the service with reasonable notice.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about these terms: <Contact />.
      </p>
    </LegalPage>
  );
}
