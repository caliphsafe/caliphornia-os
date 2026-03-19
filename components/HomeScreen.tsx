"use client";

import AppIcon from "@/components/AppIcon";
import { appRegistry } from "@/lib/app-registry";

export default function HomeScreen({ email }: { email: string }) {
  async function handleLogout() {
    await fetch("/api/logout", { method: "POST" });
    window.location.href = "/";
  }

  return (
    <main className="iphone-shell home-screen ios-home-screen">
      <div className="home-inner ios-home-inner">
        <div className="home-topbar">
          <div className="home-brand-chip">Caliphornia OS</div>

          <button
            className="account-chip"
            onClick={handleLogout}
            title={email}
            aria-label="Log out"
          >
            {email.slice(0, 1).toUpperCase()}
          </button>
        </div>

        <section className="home-feature-card">
          <div className="feature-blur-orb" />
          <div className="feature-copy">
            <span className="feature-kicker">Direct to fan</span>
            <h1>Your music as an operating system</h1>
            <p>
              Songs, text worlds, lyric games, playlists, visuals, drops, and future apps
              all in one place.
            </p>
          </div>
        </section>

        <section className="app-grid ios-app-grid">
          {appRegistry.map((app) => (
            <AppIcon key={app.id} app={app} />
          ))}
        </section>

        <div className="bottom-dock">
          <a href="/apps/music" className="dock-app dock-music">
            <span className="dock-dot" />
            <span>Music</span>
          </a>
          <a href="/apps/friends" className="dock-app">
            <span className="dock-dot" />
            <span>frie.ends</span>
          </a>
          <a href="/apps/fartherhood" className="dock-app">
            <span className="dock-dot" />
            <span>FarTHERHOOD</span>
          </a>
        </div>
      </div>
    </main>
  );
}