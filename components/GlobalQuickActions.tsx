"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const HIDDEN_PREFIXES = ["/guest", "/unlock", "/dashboard"];

const links = [
  { href: "/home", label: "Home", icon: "⌂" },
  { href: "/apps/music", label: "Music", icon: "♪" },
  { href: "/apps/share", label: "Share", icon: "⌁" },
  { href: "/apps/account", label: "Account", icon: "◎" },
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

  return (
    <footer className="cos-app-utility-footer">
      <nav
        className="cos-app-utility-nav"
        aria-label="Caliphornia OS navigation"
      >
        {links.map((link) => {
          const active =
            link.href === "/home"
              ? pathname === "/home"
              : pathname.startsWith(link.href);

          return (
            <Link
              href={link.href}
              key={link.href}
              className={`cos-app-utility-link${
                active ? " active" : ""
              }`}
              aria-current={active ? "page" : undefined}
            >
              <span aria-hidden="true">{link.icon}</span>
              <strong>{link.label}</strong>
            </Link>
          );
        })}
      </nav>
    </footer>
  );
}
