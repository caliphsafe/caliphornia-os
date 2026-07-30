"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function quickActionMode(pathname: string) {
  if (pathname.startsWith("/apps/friends")) return "is-friends";
  if (pathname.startsWith("/apps/fartherhood")) return "is-fartherhood";
  if (pathname.startsWith("/apps/calendar")) return "is-calendar";
  if (pathname.startsWith("/apps/stats")) return "is-stats";
  if (pathname.startsWith("/apps/milia")) return "is-milia";
  if (pathname.startsWith("/apps/music")) return "is-music";
  return "";
}

export default function GlobalQuickActions() {
  const pathname = usePathname() || "/";

  const hidden =
    pathname === "/" ||
    pathname === "/home" ||
    pathname === "/apps/share" ||
    pathname === "/apps/account" ||
    pathname === "/apps/wallet" ||
    pathname.startsWith("/guest") ||
    pathname.startsWith("/unlock");

  if (hidden) return null;

  return (
    <nav
      className={`cos-quick-actions ${quickActionMode(pathname)}`}
      aria-label="Caliphornia OS quick actions"
    >
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
