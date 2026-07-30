"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

type AccessPlan = "project" | "kiiku_pass_30d" | "supporter_subscription";

type AccessStatus = {
  ok?: boolean;
  signedIn?: boolean;
  email?: string;
  hasKiikuPass?: boolean;
  hasProjectAccess?: boolean;
  hasAllAccess?: boolean;
  hasMusicFull?: boolean;
  isFounder?: boolean;
  projectAccess?: string[];
};

type AccessWindowProps = {
  projectSlug?: string;
  projectName?: string;
  children?: ReactNode;
  className?: string;
  triggerClassName?: string;
  triggerImgClassName?: string;
  triggerLabel?: string;
};

const PROJECT_COPY: Record<string, { name: string; icon: string; price: string; details: string }> = {
  friends: {
    name: "Fri.ends",
    icon: "/icons/friends.png",
    price: "$4.99",
    details: "Full conversations, final songs, audio bubbles, lyrics, games, and project extras.",
  },
  fartherhood: {
    name: "FarTHErHOOD",
    icon: "/icons/fatherhood.png",
    price: "$4.99",
    details: "Full songs, full notes, lyrics, voice entries, story layers, and project extras.",
  },
  fatherhood: {
    name: "FarTHErHOOD",
    icon: "/icons/fatherhood.png",
    price: "$4.99",
    details: "Full songs, full notes, lyrics, voice entries, story layers, and project extras.",
  },
  milia: {
    name: "Milia",
    icon: "/icons/milia.png",
    price: "$4.99",
    details: "Full songs, lyrics, weather-linked memories, project scenes, and bonus layers.",
  },
  music: {
    name: "Music",
    icon: "/icons/music.png",
    price: "$4.99",
    details: "Full listening, playlist access, lyrics, project extras, and bonus music surfaces.",
  },
};

const APP_LINKS = [
  { slug: "friends", name: "Fri.ends", href: "/apps/friends", icon: "/icons/friends.png" },
  { slug: "fartherhood", name: "FarTHErHOOD", href: "/apps/fartherhood", icon: "/icons/fatherhood.png" },
  { slug: "milia", name: "Milia", href: "/apps/milia", icon: "/icons/milia.png" },
  { slug: "music", name: "Music", href: "/apps/music", icon: "/icons/music.png" },
  { slug: "share", name: "Share", href: "/apps/share", icon: "/icons/share.svg", free: true },
  { slug: "stats", name: "Stats", href: "/apps/stats", icon: "/icons/stats.png", free: true },
];

function ownsApp(app: { slug: string; free?: boolean }, access: AccessStatus | null) {
  if (app.free) return true;
  if (access?.hasKiikuPass || access?.hasAllAccess || access?.isFounder) return true;
  return Boolean(access?.projectAccess?.includes(app.slug));
}

export default function AccessWindow({
  projectSlug = "music",
  projectName,
  children,
  className = "",
  triggerClassName = "",
  triggerLabel = "Open access window",
}: AccessWindowProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [autoRenew, setAutoRenew] = useState(false);
  const [error, setError] = useState("");
  const [accessStatus, setAccessStatus] = useState<AccessStatus | null>(null);

  const normalizedProjectSlug = projectSlug.trim().toLowerCase();
  const project = useMemo(() => {
    const fallback = {
      name: projectName || "This Project",
      icon: "/icons/access.png",
      price: "$4.99",
      details: "Full songs, lyrics, project features, and extras inside Caliphornia OS.",
    };
    const copy = PROJECT_COPY[normalizedProjectSlug] || fallback;
    return { ...copy, name: projectName || copy.name };
  }, [normalizedProjectSlug, projectName]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    let active = true;
    async function loadAccessStatus() {
      try {
        const res = await fetch(`/api/access/me?projectSlug=${encodeURIComponent(normalizedProjectSlug)}`, {
          cache: "no-store",
        });
        const data = await res.json();
        if (active) setAccessStatus(data);
      } catch {
        if (active) setAccessStatus(null);
      }
    }
    loadAccessStatus();
    return () => {
      active = false;
    };
  }, [normalizedProjectSlug]);

  useEffect(() => {
    if (!isOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    document.body.classList.add("access-window-open");
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.classList.remove("access-window-open");
    };
  }, [isOpen]);

  async function startCheckout(plan: AccessPlan) {
    if (isCheckingOut) return;
    setError("");
    setIsCheckingOut(true);
    try {
      const res = await fetch("/api/checkout/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, projectSlug: normalizedProjectSlug }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok || !data?.url) throw new Error(data?.error || "Checkout could not be started.");
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout could not be started.");
      setIsCheckingOut(false);
    }
  }

  const hasKiikuPass = Boolean(accessStatus?.hasKiikuPass || accessStatus?.hasAllAccess || accessStatus?.isFounder);
  const hasProjectAccess = Boolean(accessStatus?.hasProjectAccess);
  const passPlan: AccessPlan = autoRenew ? "supporter_subscription" : "kiiku_pass_30d";

  const modal = (
    <div className="access-window-overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setIsOpen(false)}>
      <section className="access-window-card" role="dialog" aria-modal="true" aria-label="Caliphornia OS access window">
        <div className="access-window-topbar">
          <div>
            <p className="access-window-kicker">Caliphornia OS Access</p>
            <h2>{hasKiikuPass ? "Your Kiiku Pass" : "Unlock Access"}</h2>
          </div>
          <button type="button" className="access-window-close" aria-label="Close access window" onClick={() => setIsOpen(false)}>
            ×
          </button>
        </div>

        {hasKiikuPass ? (
          <div className="kiiku-pass-active-card">
            <div className="kiiku-pass-active-icon"><img src="/icons/access.png" alt="" /></div>
            <div>
              <p className="kiiku-label">Full access active</p>
              <h3>Kiiku Pass is on</h3>
              <p>Your account has full access across current Caliphornia OS projects.</p>
            </div>
          </div>
        ) : null}

        {!hasProjectAccess && !hasKiikuPass ? (
          <div className="kiiku-album-card">
            <div className="kiiku-album-main">
              <div className="kiiku-app-icon-wrap"><img src={project.icon} alt="" className="kiiku-app-icon" /></div>
              <div className="kiiku-album-copy">
                <p className="kiiku-label">Project unlock</p>
                <h3>{project.name}</h3>
                <p>{project.details}</p>
              </div>
            </div>
            <button type="button" className="kiiku-primary-btn" disabled={isCheckingOut} onClick={() => startCheckout("project")}>
              {isCheckingOut ? "Opening Checkout..." : "Unlock Project"}
              <span>{project.price}</span>
            </button>
          </div>
        ) : null}

        {!hasKiikuPass ? (
          <div className="kiiku-pass-card">
            <div className="kiiku-pass-header">
              <div>
                <p className="kiiku-label">Full OS access</p>
                <h3>Kiiku Pass</h3>
                <p>Open every current Caliphornia OS project with one listening pass.</p>
              </div>
            </div>
            <div className="kiiku-pass-panel">
              <div>
                <p className="kiiku-pass-mode">Go monthly</p>
                <p className="kiiku-pass-small">Turn this on to make your Kiiku Pass renew every month.</p>
              </div>
              <button type="button" className={`kiiku-toggle ${autoRenew ? "is-on" : ""}`} aria-pressed={autoRenew} onClick={() => setAutoRenew((value) => !value)}>
                <span />
              </button>
            </div>
            <button type="button" className="kiiku-pass-btn" disabled={isCheckingOut} onClick={() => startCheckout(passPlan)}>
              {isCheckingOut ? "Opening Checkout..." : autoRenew ? "Start Monthly Kiiku Pass" : "Start 30-Day Kiiku Pass"}
              <span>{autoRenew ? "$3.99/mo" : "$3.99"}</span>
            </button>
          </div>
        ) : null}

        <div className="kiiku-app-access-card">
          <div className="kiiku-app-access-head">
            <div>
              <p className="kiiku-label">Your apps</p>
              <h3>{hasKiikuPass ? "All apps unlocked" : "Open your access"}</h3>
            </div>
            <Link href="/apps/account" className="kiiku-account-small-link">Account</Link>
          </div>
          <div className="kiiku-app-links-grid">
            {APP_LINKS.map((app) => {
              const unlocked = ownsApp(app, accessStatus);
              return (
                <Link href={app.href} className={`kiiku-app-link ${unlocked ? "is-unlocked" : ""}`} key={app.slug} onClick={() => setIsOpen(false)}>
                  <img src={app.icon} alt="" />
                  <span>{app.name}</span>
                  <small>{unlocked ? "Unlocked" : "Preview"}</small>
                </Link>
              );
            })}
          </div>
        </div>

        <p className="kiiku-legal">Kiiku is internal Caliphornia OS participation credit. It is not cash, not crypto, not transferable, and not redeemable for money. Full details live in Account.</p>
        {error ? <p className="access-window-error">{error}</p> : null}
      </section>
    </div>
  );

  // Cleanup: remove the old default top-right Kiiku icon trigger. Only pages that pass
  // their own visible children get a button now.
  if (!children) return mounted && isOpen ? createPortal(modal, document.body) : null;

  return (
    <>
      <button type="button" className={["access-window-trigger", className, triggerClassName].filter(Boolean).join(" ")} aria-label={triggerLabel} onClick={() => setIsOpen(true)}>
        {children}
      </button>
      {mounted && isOpen ? createPortal(modal, document.body) : null}
    </>
  );
}
