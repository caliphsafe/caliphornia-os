"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import {
  globalNavigation,
  type GlobalNavigationIcon,
} from "@/lib/app-registry";

function NavigationIcon({ name }: { name: GlobalNavigationIcon }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    viewBox: "0 0 24 24",
    "aria-hidden": true as const,
  };

  if (name === "home") {
    return (
      <svg {...common}>
        <path d="m3 10.5 9-7.5 9 7.5" />
        <path d="M5.5 9.5V21h13V9.5" />
        <path d="M9.5 21v-6.5h5V21" />
      </svg>
    );
  }

  if (name === "music") {
    return (
      <svg {...common}>
        <path d="M9 18V5l12-2v13" />
        <path d="m9 8 12-2" />
        <ellipse cx="6" cy="18.5" rx="3" ry="2.5" />
        <ellipse cx="18" cy="16.5" rx="3" ry="2.5" />
      </svg>
    );
  }

  if (name === "share") {
    return (
      <svg {...common}>
        <path d="M12 15V3" />
        <path d="m8 7 4-4 4 4" />
        <path d="M5 13v7h14v-7" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4.5 21c.8-4 3.3-6 7.5-6s6.7 2 7.5 6" />
    </svg>
  );
}

export default function GlobalQuickActions() {
  const pathname = usePathname() || "";

  useEffect(() => {
    document.body.classList.add("has-os-navigation");
    return () => document.body.classList.remove("has-os-navigation");
  }, []);

  return (
    <footer className="cos-app-utility-footer">
      <nav
        className="cos-app-utility-nav"
        aria-label="Caliphornia OS navigation"
      >
        {globalNavigation.map((link) => {
          const active =
            pathname === link.href ||
            pathname.startsWith(link.href + "/");

          return (
            <Link
              href={link.href}
              key={link.id}
              className={`cos-app-utility-link${active ? " active" : ""}`}
              aria-current={active ? "page" : undefined}
            >
              <span className="cos-app-utility-icon">
                <NavigationIcon name={link.icon} />
              </span>
              <strong>{link.label}</strong>
            </Link>
          );
        })}
      </nav>
    </footer>
  );
}
