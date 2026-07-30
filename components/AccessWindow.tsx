"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

type AccessWindowProps = {
  projectSlug?: string;
  projectName?: string;
  children?: ReactNode;
  className?: string;
  triggerClassName?: string;
  triggerImgClassName?: string;
  triggerLabel?: string;
};

type AccessStatus = {
  ok?: boolean;
  hasKiikuPass?: boolean;
  hasProjectAccess?: boolean;
  hasAllAccess?: boolean;
  hasMusicFull?: boolean;
  projectAccess?: string[];
};

const PROJECT_COPY: Record<string, { name: string; price: string; productType: string }> = {
  friends: { name: "Fri.ends", price: "$4.99", productType: "project" },
  fartherhood: { name: "FarTHErHOOD", price: "$4.99", productType: "project" },
  fatherhood: { name: "FarTHErHOOD", price: "$4.99", productType: "project" },
  milia: { name: "Milia", price: "$4.99", productType: "project" },
  music: { name: "Music", price: "$4.99", productType: "project" },
};

export default function AccessWindow({
  projectSlug = "music",
  projectName,
  children,
  className = "",
  triggerClassName = "",
  triggerLabel = "Open access",
}: AccessWindowProps) {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<AccessStatus | null>(null);
  const [error, setError] = useState("");
  const [checkingOut, setCheckingOut] = useState(false);
  const normalized = projectSlug.trim().toLowerCase();

  const project = useMemo(() => {
    const copy = PROJECT_COPY[normalized] || { name: projectName || "This Project", price: "$4.99", productType: "project" };
    return { ...copy, name: projectName || copy.name };
  }, [normalized, projectName]);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    let active = true;
    fetch(`/api/access/me?projectSlug=${encodeURIComponent(normalized)}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((json) => { if (active) setStatus(json); })
      .catch(() => { if (active) setStatus(null); });
    return () => { active = false; };
  }, [normalized]);

  async function startCheckout(plan: "project" | "kiiku_pass_30d" | "supporter_subscription") {
    setCheckingOut(true);
    setError("");
    try {
      const res = await fetch("/api/checkout/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, projectSlug: normalized }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok || !data?.url) throw new Error(data?.error || "Checkout could not open.");
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout could not open.");
      setCheckingOut(false);
    }
  }

  if (!children) return null;

  const hasFull = Boolean(status?.hasKiikuPass || status?.hasAllAccess || status?.hasMusicFull);
  const hasProject = Boolean(status?.hasProjectAccess || status?.projectAccess?.includes(normalized));

  const modal = (
    <div className="access-window-overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}>
      <section className="access-window-card" role="dialog" aria-modal="true" aria-label="Caliphornia OS access">
        <div className="access-window-topbar">
          <div>
            <p className="access-window-kicker">Caliphornia OS Access</p>
            <h2>{hasFull ? "Full access active" : hasProject ? `${project.name} unlocked` : "Unlock the experience"}</h2>
          </div>
          <button type="button" className="access-window-close" onClick={() => setOpen(false)} aria-label="Close">×</button>
        </div>

        <div className="kiiku-pass-card">
          <p className="kiiku-label">Kiiku Credits</p>
          <h3>Listen, share, unlock.</h3>
          <p>Kiiku is the in-platform participation credit for Caliphornia OS. It is used for access and unlocks only. It is not cash, not crypto, not transferable, and not redeemable for money.</p>
        </div>

        {!hasProject && !hasFull ? (
          <div className="kiiku-album-card">
            <p className="kiiku-label">Project unlock</p>
            <h3>{project.name}</h3>
            <p>Unlock full songs, app layers, lyrics, and Share permissions for this experience.</p>
            <button type="button" className="kiiku-primary-btn" disabled={checkingOut} onClick={() => startCheckout("project")}>
              {checkingOut ? "Opening checkout..." : `Unlock ${project.name}`} <span>{project.price}</span>
            </button>
          </div>
        ) : null}

        {!hasFull ? (
          <div className="kiiku-pass-card">
            <p className="kiiku-label">Full OS access</p>
            <h3>Kiiku Pass</h3>
            <p>Open every current Caliphornia OS project with one listening pass.</p>
            <button type="button" className="kiiku-pass-btn" disabled={checkingOut} onClick={() => startCheckout("kiiku_pass_30d")}>Start 30-Day Kiiku Pass <span>$3.99</span></button>
          </div>
        ) : null}

        {error ? <p className="access-window-error">{error}</p> : null}
      </section>
    </div>
  );

  return (
    <>
      <button type="button" className={["access-window-trigger", className, triggerClassName].filter(Boolean).join(" ")} aria-label={triggerLabel} onClick={() => setOpen(true)}>
        {children}
      </button>
      {mounted && open ? createPortal(modal, document.body) : null}
    </>
  );
}
