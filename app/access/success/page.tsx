import Link from "next/link";

export default function AccessSuccessPage({
  searchParams,
}: {
  searchParams?: Promise<{ session_id?: string }>;
}) {
  return (
    <main className="access-result-page">
      <section className="access-result-card">
        <div className="access-result-icon">✓</div>
        <p className="access-result-kicker">Access updated</p>
        <h1>You’re unlocked.</h1>
        <p>
          Your access is being confirmed. If it does not show immediately, refresh the app in a few seconds.
        </p>

        <div className="access-result-actions">
          <Link href="/home" className="access-result-btn">
            Back to Home
          </Link>
          <Link href="/apps/music" className="access-result-btn secondary">
            Open Music
          </Link>
        </div>
      </section>
    </main>
  );
}
