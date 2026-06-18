import Link from "next/link";

export default function AccessCancelPage() {
  return (
    <main className="access-result-page">
      <section className="access-result-card">
        <div className="access-result-icon muted">×</div>
        <p className="access-result-kicker">Checkout canceled</p>
        <h1>No worries.</h1>
        <p>
          You can keep using free previews and come back to unlock the full experience anytime.
        </p>

        <div className="access-result-actions">
          <Link href="/home" className="access-result-btn">
            Back to Home
          </Link>
        </div>
      </section>
    </main>
  );
}
