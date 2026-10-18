import type { JSX } from "react";
import { Brand } from "./components/Brand";
import { ToastProvider } from "./components/Toast";
import { Link, matchPath, usePath } from "./lib/router";
import { Login, Register } from "./pages/Auth";
import { Landing } from "./pages/Landing";
import { Privacy, Terms } from "./pages/Legal";
import { Live } from "./pages/Live";
import { SelfCheckin } from "./pages/SelfCheckin";
import { Umpire } from "./pages/Umpire";
import { AppHome } from "./pages/app/AppHome";
import { AppLayout } from "./pages/app/AppLayout";
import { Club } from "./pages/app/Club";
import { Players } from "./pages/app/Players";
import { SessionControl } from "./pages/app/SessionControl";
import { Sessions } from "./pages/app/Sessions";
import { TeamSettings } from "./pages/app/TeamSettings";

function Routes() {
  const path = usePath().replace(/\/+$/, "") || "/";

  if (path === "/") return <Landing />;
  if (path === "/login") return <Login />;
  if (path === "/register") return <Register />;
  if (path === "/terms") return <Terms />;
  if (path === "/privacy") return <Privacy />;
  if (path === "/app") return <AppHome />;

  const live = matchPath("/live/:token", path);
  if (live) return <Live key={live.token} token={live.token} />;
  const checkin = matchPath("/live/:token/checkin", path);
  if (checkin) return <SelfCheckin token={checkin.token} />;
  const umpire = matchPath("/ump/:token", path);
  if (umpire) return <Umpire key={umpire.token} token={umpire.token} />;

  const session = matchPath("/app/session/:id", path);
  if (session) {
    return (
      <AppLayout path="/app/sessions">
        <SessionControl key={session.id} id={session.id} />
      </AppLayout>
    );
  }
  const pages: Record<string, () => JSX.Element> = {
    "/app/sessions": Sessions,
    "/app/club": Club,
    "/app/players": Players,
    "/app/team": TeamSettings,
  };
  const Page = pages[path];
  if (Page) {
    return (
      <AppLayout path={path}>
        <Page />
      </AppLayout>
    );
  }

  return (
    <main className="auth">
      <div className="auth-card">
        <Brand />
        <div className="panel empty">
          <h1>This page doesn't exist</h1>
          <p className="muted">If you scanned a QR code, ask your organizer for the newest one.</p>
          <Link to="/" className="btn">
            Go to the home page
          </Link>
        </div>
      </div>
    </main>
  );
}

export function App() {
  return (
    <ToastProvider>
      <Routes />
    </ToastProvider>
  );
}
