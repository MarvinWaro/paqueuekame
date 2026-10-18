import type { CSSProperties, ReactNode } from "react";
import { courtColorsOf } from "../../../shared/courtThemes";
import type { Me } from "../../../shared/types";
import { BrandMark } from "../../components/Brand";
import { Icon, type IconName } from "../../components/Icon";
import { ThemeToggle } from "../../components/ThemeToggle";
import { api } from "../../lib/api";
import { useCourtColors } from "../../lib/courtTheme";
import { Link, navigate } from "../../lib/router";
import { useApi } from "../../lib/useApi";

const NAV: { to: string; label: string; icon: IconName; match: string }[] = [
  { to: "/app", label: "Courts", icon: "court", match: "/app/sessions" },
  { to: "/app/players", label: "Players", icon: "people", match: "/app/players" },
  { to: "/app/club", label: "Club", icon: "trophy", match: "/app/club" },
  { to: "/app/team", label: "Team", icon: "gear", match: "/app/team" },
];

export function AppLayout({ path, children }: { path: string; children: ReactNode }) {
  const { data: me } = useApi<Me>("/api/me");
  useCourtColors(me && courtColorsOf(me.team.courtTheme, me.team.customColors));
  const current = (m: string) => path === m;
  const active = NAV.findIndex((n) => current(n.match));

  const logout = async () => {
    await api("/api/auth/logout", { method: "POST" }).catch(() => {});
    navigate("/login", { replace: true });
  };

  return (
    <div className="has-bottom-nav">
      <header className="topbar">
        <div className="wrap topbar-inner">
          <Link to="/app" className="brand" aria-label="NEXA">
            <BrandMark />
            <span>{me?.team.name ?? "NEXA"}</span>
          </Link>
          <nav className="nav" aria-label="Main">
            {NAV.map((n) => (
              <Link key={n.label} to={n.to} aria-current={current(n.match) ? "page" : undefined} data-tour={`nav-${n.label.toLowerCase()}`}>
                {n.label}
              </Link>
            ))}
          </nav>
          <ThemeToggle />
          <button type="button" className="icon-btn" onClick={logout} aria-label="Log out" title="Log out">
            <Icon name="logout" />
          </button>
        </div>
      </header>
      <main className="wrap">{children}</main>
      <nav
        className={active < 0 ? "bottom-nav no-active" : "bottom-nav"}
        aria-label="Main"
        style={{ "--i": active } as CSSProperties}
      >
        {NAV.map((n) => (
          <Link key={n.label} to={n.to} aria-current={current(n.match) ? "page" : undefined} data-tour={`nav-${n.label.toLowerCase()}`}>
            <Icon name={n.icon} />
            {n.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
