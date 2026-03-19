"use client";

import AppIcon from "@/components/AppIcon";
import { appRegistry } from "@/lib/app-registry";

export default function HomeScreen({ email }: { email: string }) {
  return (
    <main className="iphone-shell home-screen">
      <div className="home-inner">
        <div className="status-bar">
          <span>9:41</span>
          <span className="status-email">{email}</span>
        </div>

        <div className="home-header">
          <h1>Caliphornia OS</h1>
          <p>Your projects, music, games, and future drops in one place.</p>
        </div>

        <section className="app-grid">
          {appRegistry.map((app) => (
            <AppIcon key={app.id} app={app} />
          ))}
        </section>

        <div className="dock">
          <button
            className="ghost-btn"
            onClick={async () => {
              await fetch("/api/logout", { method: "POST" });
              window.location.href = "/";
            }}
          >
            Log Out
          </button>
        </div>
      </div>
    </main>
  );
}
