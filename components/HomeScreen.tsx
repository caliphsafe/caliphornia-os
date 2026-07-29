import { appRegistry } from "@/lib/app-registry";
import type { AppUser } from "@/types/domain";

function displayName(user: AppUser) {
  return user.username || user.email.split("@")[0] || "Caliphornia";
}

function dateLabel() {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export default function HomeScreen({ user }: { user: AppUser }) {
  const dockIds = new Set(["music", "nearby", "stats", "wallet"]);
  const desktopApps = appRegistry.filter((app) => !dockIds.has(app.id));
  const dockApps = appRegistry.filter((app) => dockIds.has(app.id));

  return (
    <main className="caliph-home-screen">
      <div className="caliph-wallpaper" aria-hidden="true" />
      <section className="caliph-phone-frame" aria-label="Caliphornia OS Home Screen">
        <div className="caliph-dynamic-island" aria-hidden="true" />

        <header className="caliph-status-area">
          <div>
            <p className="caliph-status-kicker">Caliphornia OS</p>
            <h1>{displayName(user)}</h1>
            <p>{dateLabel()}</p>
          </div>
          <a href="/api/logout" className="caliph-lock-btn">Lock</a>
        </header>

        <section className="caliph-widget-row">
          <a href="/apps/music" className="caliph-widget large">
            <span>Now Playing</span>
            <strong>Music Library</strong>
            <small>Songs, previews, unlocks, and saved tracks.</small>
          </a>

          <a href="/apps/nearby" className="caliph-widget small">
            <span>Nearby</span>
            <strong>⌁</strong>
            <small>Share without QR codes.</small>
          </a>
        </section>

        <section className="caliph-app-grid" aria-label="Apps">
          {desktopApps.map((app) => (
            <a href={app.href} className="caliph-app-icon" key={app.id}>
              <span className="caliph-icon-tile">
                <img src={app.icon} alt="" />
              </span>
              <span>{app.name}</span>
            </a>
          ))}
        </section>

        <nav className="caliph-dock" aria-label="Dock">
          {dockApps.map((app) => (
            <a href={app.href} className="caliph-dock-icon" key={app.id}>
              <span className="caliph-dock-tile">
                <img src={app.icon} alt="" />
              </span>
              <span>{app.name}</span>
            </a>
          ))}
        </nav>
      </section>
    </main>
  );
}
