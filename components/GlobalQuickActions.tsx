"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const HIDDEN_PREFIXES = [
  "/apps/share",
  "/apps/account",
  "/apps/wallet",
  "/guest",
  "/unlock",
  "/home",
];

export default function GlobalQuickActions() {
  const pathname = usePathname() || "";

  if (pathname === "/" || HIDDEN_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return null;
  }

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
