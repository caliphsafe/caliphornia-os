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

      <style jsx>{`
        .dash-wrap {
          min-height: 100dvh;
          padding: 28px 20px 40px;
          background:
            radial-gradient(circle at top, rgba(255,255,255,0.08), transparent 40%),
            linear-gradient(180deg, #07111f 0%, #0b1526 100%);
          color: #f6f7fb;
        }

        .dash-hero {
          max-width: 980px;
          margin: 0 auto 24px;
        }

        .dash-kicker {
          margin: 0 0 8px;
          opacity: 0.65;
          font-size: 12px;
          letter-spacing: 0.16em;
          text-transform: uppercase;
        }

        h1 {
          margin: 0 0 10px;
          font-size: clamp(32px, 5vw, 52px);
          line-height: 1;
        }

        .dash-copy {
          margin: 0;
          max-width: 720px;
          opacity: 0.78;
          font-size: 15px;
          line-height: 1.55;
        }

        .dash-grid {
          max-width: 980px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px;
        }

        .dash-card {
          display: block;
          padding: 22px;
          border-radius: 24px;
          text-decoration: none;
          color: inherit;
          border: 1px solid rgba(255,255,255,0.12);
          background:
            linear-gradient(180deg, rgba(255,255,255,0.1), rgba(255,255,255,0.04)),
            rgba(12, 19, 35, 0.8);
          backdrop-filter: blur(18px);
          -webkit-backdrop-filter: blur(18px);
          box-shadow:
            0 20px 40px rgba(0,0,0,0.25),
            inset 0 1px 0 rgba(255,255,255,0.08);
          transition: transform 0.18s ease, border-color 0.18s ease;
        }

        .dash-card:hover {
          transform: translateY(-2px);
          border-color: rgba(255,255,255,0.22);
        }

        .dash-card.primary {
          background:
            linear-gradient(180deg, rgba(255,255,255,0.14), rgba(255,255,255,0.05)),
            rgba(14, 24, 42, 0.9);
        }

        .dash-card-top {
          margin-bottom: 14px;
        }

        .dash-badge {
          display: inline-flex;
          align-items: center;
          min-height: 28px;
          padding: 0 10px;
          border-radius: 999px;
          font-size: 12px;
          background: rgba(255,255,255,0.1);
          border: 1px solid rgba(255,255,255,0.1);
        }

        .dash-card h2 {
          margin: 0 0 10px;
          font-size: 24px;
        }

        .dash-card p {
          margin: 0;
          opacity: 0.8;
          line-height: 1.6;
          font-size: 14px;
        }

        @media (max-width: 780px) {
          .dash-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  );
}