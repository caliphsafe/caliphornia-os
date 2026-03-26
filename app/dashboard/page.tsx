import Link from "next/link";

export default function DashboardPage() {
  return (
    <main style={{ padding: 24, maxWidth: 960, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ marginBottom: 8 }}>Dashboard</h1>
        <p style={{ margin: 0, opacity: 0.75 }}>
          Manage songs, app placement, and advanced Fri.ends conversation builds.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 16
        }}
      >
        <Link
          href="/dashboard/import-song"
          style={{
            display: "block",
            padding: 20,
            borderRadius: 18,
            border: "1px solid rgba(255,255,255,0.12)",
            textDecoration: "none",
            color: "inherit",
            background: "rgba(255,255,255,0.04)"
          }}
        >
          <h2 style={{ marginTop: 0, marginBottom: 8 }}>Song Manager</h2>
          <p style={{ margin: 0, opacity: 0.75 }}>
            Upload songs, replace audio and cover art, edit lyrics and metadata,
            assign songs to apps, and manage song order across all apps.
          </p>
        </Link>

        <Link
          href="/dashboard/friends-builder"
          style={{
            display: "block",
            padding: 20,
            borderRadius: 18,
            border: "1px solid rgba(255,255,255,0.12)",
            textDecoration: "none",
            color: "inherit",
            background: "rgba(255,255,255,0.04)"
          }}
        >
          <h2 style={{ marginTop: 0, marginBottom: 8 }}>Fri.ends Builder</h2>
          <p style={{ margin: 0, opacity: 0.75 }}>
            Build full Fri.ends conversations with alternate audio versions,
            messages, timestamps, and clip timing.
          </p>
        </Link>
      </div>
    </main>
  );
}
