import Link from "next/link";
import { appRegistry } from "@/lib/app-registry";
import type { AppUser } from "@/types/domain";

function displayName(user: AppUser) {
  return user.username || user.email.split("@")[0] || "Caliphornia";
}

function todayLabel() {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric"
  }).format(new Date());
}

export default function HomeScreen({ user }: { user: AppUser }) {
  const dockApps = appRegistry.filter((app) => app.dock);
  const homeApps = appRegistry.filter((app) => !app.dock);

  return (
    <main className="ios-home-page">
      <section className="ios-home-phone">
        <header className="ios-home-status">
          <div>
            <p>Caliphornia OS</p>
            <h1>{displayName(user)}</h1>
          </div>

          <div className="ios-home-actions">
            <Link href="/apps/share">Share</Link>
            <Link href="/apps/account">Account</Link>
          </div>
        </header>

        <section className="ios-home-widget-row">
          <div className="ios-home-widget large">
            <span>{todayLabel()}</span>
            <strong>Music, apps, access, Kiiku, and sharing in one world.</strong>
          </div>
          <Link href="/apps/share" className="ios-home-widget share-card">
            <span>Share</span>
            <strong>Send a song nearby</strong>
          </Link>
        </section>

        <section className="ios-home-grid" aria-label="Apps">
          {homeApps.map((app) => (
            <Link href={app.href} className="ios-app-icon" key={app.id}>
              <span className="ios-app-icon-tile">
                <img src={app.icon} alt="" />
              </span>
              <span className="ios-app-icon-name">{app.name}</span>
              <small>{app.subtitle || app.passLabel}</small>
            </Link>
          ))}
        </section>

        <nav className="ios-home-dock" aria-label="Dock">
          {dockApps.map((app) => (
            <Link href={app.href} className="ios-dock-app" key={app.id}>
              <span className="ios-dock-icon">
                <img src={app.icon} alt="" />
              </span>
              <span>{app.name}</span>
              <small>{app.passLabel}</small>
            </Link>
          ))}
        </nav>
      </section>
    </main>
  );
}
