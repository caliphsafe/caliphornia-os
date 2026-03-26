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
            title={`Log out ${email}`}
            aria-label="Log out"
          >
            {email.slice(0, 1).toUpperCase()}
          </button>
        </div>

        <section className="home-feature-card">
          <div className="feature-blur-orb feature-orb-one" />
          <div className="feature-blur-orb feature-orb-two" />

          <div className="feature-copy">
            <span className="feature-kicker">Welcome To Caliphornia</span>
            <h1>cOS 1.8</h1>
            <p>
              A cinematic ecosystem of text worlds, music experiences, evolving playlists, visual drops, and future apps.
            </p>
          </div>
        </section>

       <section className="widget-row">
  <a
  href={`/apps/music?email=${encodeURIComponent(email)}`}
  className="widget-card widget-now-playing"
>
  <div className="widget-label">Library</div>
  <div className="widget-title">Music</div>
  <div className="widget-subtitle">Build personal playlists across projects</div>
</a>

  <div className="widget-card widget-folder">
    <div className="widget-label">Collection</div>
    <div className="folder-grid">
      <span className="folder-mini folder-blue" />
      <span className="folder-mini folder-gold" />
      <span className="folder-mini folder-pink" />
      <span className="folder-mini folder-white" />
    </div>
    <div className="widget-subtitle">Apps, drops, and future worlds</div>
  </div>
</section>

        <section className="app-grid ios-app-grid">
          {appRegistry.map((app) => (
           <AppIcon key={app.id} app={app} email={email} />
          ))}
        </section>
      </div>
    </main>
  );
}
