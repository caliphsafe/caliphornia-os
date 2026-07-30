import Link from "next/link";

export default function GlobalQuickActions() {
  return (
    <nav className="cos-quick-actions" aria-label="Caliphornia OS quick actions">
      <Link href="/apps/share" className="cos-quick-action share">
        <span className="cos-quick-action-icon">⌁</span>
        <span className="cos-quick-action-label">Share</span>
      </Link>
      <Link href="/apps/account" className="cos-quick-action account">
        <span className="cos-quick-action-icon">⚙</span>
        <span className="cos-quick-action-label">Account</span>
      </Link>
    </nav>
  );
}
