"use client";

import AppIcon from "@/components/AppIcon";
import { appRegistry } from "@/lib/app-registry";

export default function HomeScreen({
  email,
  username,
  role
}: {
  email: string;
  username?: string;
  role?: string;
}) {

  return (
    <main className="iphone-shell home-screen ios-home-screen">
      <div className="home-inner ios-home-inner">
        <div className="home-topbar">
          <div className="home-brand-chip">Caliphornia OS</div>

          <div
  className="account-chip"
  title={username ? `@${username}` : email}
>
  {username
    ? `@${username}`
    : email.slice(0, 1).toUpperCase()}
</div>
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

               <section className="app-grid ios-app-grid">
          {appRegistry.map((app) => (
            <AppIcon key={app.id} app={app} email={email} />
          ))}

          {role === "admin" ? (
            <a href="/dashboard" className="ios-app-icon" aria-label="Dashboard">
              <div className="ios-app-icon-tile">
                <div className="admin-app-glyph">⌘</div>
                <div className="icon-shine" />
                <div className="icon-glow" />
              </div>
              <div className="app-icon-label">Dashboard</div>
            </a>
          ) : null}
        </section>
      </div>
    </main>
  );
}
