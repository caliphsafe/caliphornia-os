import { appRegistry } from "@/lib/app-registry";
import type { AppUser } from "@/types/domain";

function displayName(user: AppUser) {
  return user.username || user.email.split("@")[0] || "Caliphornia";
}

function todayLabel() {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function iconGradient(id: string) {
  const gradients: Record<string, string> = {
    fartherhood: "linear-gradient(145deg,#facc15,#2b2110)",
    friends: "linear-gradient(145deg,#34c759,#0b6b36)",
    milia: "linear-gradient(145deg,#7dd3fc,#2563eb)",
    music: "linear-gradient(145deg,#ff2d55,#7c1d6f)",
    share: "linear-gradient(145deg,#7dd3fc,#8b5cf6 52%,#f8d477)",
    wallet: "linear-gradient(145deg,#f8d477,#a16207)",
    calendar: "linear-gradient(145deg,#ffffff,#dbeafe)",
    stats: "linear-gradient(145deg,#111827,#000000)",
    account: "linear-gradient(145deg,#d1d5db,#374151)",
  };
  return gradients[id] || "linear-gradient(145deg,rgba(255,255,255,.30),rgba(255,255,255,.08))";
}

export default function HomeScreen({ user }: { user: AppUser }) {
  const dockIds = new Set(["phone-none", "music", "share", "stats", "account"]);
  const dockApps = appRegistry.filter((app) => dockIds.has(app.id));
  const screenApps = appRegistry.filter((app) => !dockIds.has(app.id));

  return (
    <main className="ios-home-root">
      <div className="ios-wallpaper" aria-hidden="true" />

      <section className="ios-device" aria-label="Caliphornia OS Home Screen">
        <div className="ios-dynamic-island" aria-hidden="true" />

        <header className="ios-status-area">
          <div>
            <span className="ios-status-kicker">Caliphornia OS</span>
            <h1>{displayName(user)}</h1>
            <p>{todayLabel()}</p>
          </div>
          <a className="ios-lock-pill" href="/api/logout">Lock</a>
        </header>

        <section className="ios-widget-grid" aria-label="Widgets">
          <a className="ios-widget ios-widget-large" href="/apps/music">
            <span>Now connected</span>
            <strong>Music library, access, Kiiku, and shares live together.</strong>
          </a>
          <a className="ios-widget ios-widget-small" href="/apps/share">
            <span>Share</span>
            <strong>Pass a song nearby</strong>
          </a>
        </section>

        <section className="ios-app-grid" aria-label="Apps">
          {screenApps.map((app) => (
            <a className="ios-app" href={app.href} key={app.id}>
              <span className="ios-app-tile" style={{ background: iconGradient(app.id) }}>
                <img src={app.icon} alt="" />
              </span>
              <span className="ios-app-label">{app.name}</span>
            </a>
          ))}
        </section>

        <nav className="ios-dock" aria-label="Dock">
          {dockApps.map((app) => (
            <a className="ios-dock-app" href={app.href} key={app.id} aria-label={app.name}>
              <span className="ios-dock-tile" style={{ background: iconGradient(app.id) }}>
                <img src={app.icon} alt="" />
              </span>
            </a>
          ))}
        </nav>
      </section>
    </main>
  );
}
