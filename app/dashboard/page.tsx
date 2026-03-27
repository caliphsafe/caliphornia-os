"use client";

import Link from "next/link";

export default function DashboardPage() {
  return (
    <main className="dash-wrap">
      <div className="dash-hero">
        <p className="dash-kicker">Caliphornia OS</p>
        <h1>Creator Dashboard</h1>
        <p className="dash-copy">
          Upload songs, organize app order, and build story-driven Fri.ends conversations for each release.
        </p>
      </div>

      <div className="dash-grid">
        <Link href="/dashboard/import-song" className="dash-card primary">
          <div className="dash-card-top">
            <span className="dash-badge">Main Workflow</span>
          </div>
          <h2>Song Manager</h2>
          <p>
            Upload songs, covers, lyrics, metadata, and app placement. This is your main admin entry point.
          </p>
        </Link>

        <Link href="/dashboard/friends-builder" className="dash-card">
          <div className="dash-card-top">
            <span className="dash-badge">Story Builder</span>
          </div>
          <h2>Fri.ends Builder</h2>
          <p>
            Turn a song into a conversation thread with messages, audio moments, senders, and timeline pacing.
          </p>
        </Link>
      </div>
    </main>
  );
}
