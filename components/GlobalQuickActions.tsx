"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const HIDDEN_PREFIXES = [
  "/guest",
  "/unlock",
  "/dashboard",
];

export default function GlobalQuickActions() {
  const pathname = usePathname() || "";

  if (
    pathname === "/" ||
    pathname === "/home" ||
    HIDDEN_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  ) {
    return null;
  }

  const onShare = pathname.startsWith("/apps/share");
  const onAccount = pathname.startsWith("/apps/account");

  return (
    <footer className="cos-app-utility-footer">
      <nav
        className="cos-app-utility-nav"
        aria-label="Caliphornia OS app navigation"
      >
        <Link href="/home" className="cos-app-utility-link">
          <span aria-hidden="true">⌂</span>
          <strong>Home</strong>
        </Link>

        <Link href="/apps/music" className="cos-app-utility-link">
          <span aria-hidden="true">♪</span>
          <strong>Music</strong>
        </Link>

        <Link
          href="/apps/share"
          className={`cos-app-utility-link${onShare ? " active" : ""}`}
          aria-current={onShare ? "page" : undefined}
        >
          <span aria-hidden="true">⌁</span>
          <strong>Share</strong>
        </Link>

        <Link
          href="/apps/account"
          className={`cos-app-utility-link${onAccount ? " active" : ""}`}
          aria-current={onAccount ? "page" : undefined}
        >
          <span aria-hidden="true">◎</span>
          <strong>Account</strong>
        </Link>
      </nav>
    </footer>
  );
}
