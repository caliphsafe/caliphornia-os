"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

type AccessPlan = "project" | "kiiku_pass_30d" | "supporter_subscription";

type ProjectCopy = {
  name: string;
  icon: string;
  creditCost: number;
  price: string;
  unlockLine: string;
  details: string;
};

type AccessWindowProps = {
  projectSlug?: string;
  projectName?: string;
  children?: React.ReactNode;
  className?: string;
  triggerClassName?: string;
  triggerImgClassName?: string;
  triggerLabel?: string;
};

const PROJECT_COPY: Record<string, ProjectCopy> = {
  friends: {
    name: "Fri.ends",
    icon: "/icons/friends.png",
    creditCost: 5,
    price: "$4.99",
    unlockLine: "Unlock the full album experience.",
    details:
      "Full conversations, final songs, audio bubbles, lyrics, games, and project extras.",
  },
  fartherhood: {
    name: "FarTHErHOOD",
    icon: "/icons/fatherhood.png",
    creditCost: 5,
    price: "$4.99",
    unlockLine: "Unlock the full album experience.",
    details:
      "Full songs, full notes, lyrics, voice entries, story layers, and project extras.",
  },
  fatherhood: {
    name: "FarTHErHOOD",
    icon: "/icons/fatherhood.png",
    creditCost: 5,
    price: "$4.99",
    unlockLine: "Unlock the full album experience.",
    details:
      "Full songs, full notes, lyrics, voice entries, story layers, and project extras.",
  },
  milia: {
    name: "Milia",
    icon: "/icons/milia.png",
    creditCost: 5,
    price: "$4.99",
    unlockLine: "Unlock the full album experience.",
    details:
      "Full songs, lyrics, weather-linked memories, project scenes, and extras.",
  },
  music: {
    name: "Music",
    icon: "/icons/access.png",
    creditCost: 5,
    price: "$4.99",
    unlockLine: "Unlock the full music experience.",
    details:
      "Full listening, playlist access, lyrics, project extras, and bonus music surfaces.",
  },
};

const FALLBACK_PROJECT: ProjectCopy = {
  name: "This Project",
  icon: "/icons/access.png",
  creditCost: 5,
  price: "$4.99",
  unlockLine: "Unlock the full experience.",
  details: "Full songs, lyrics, project features, and extras inside Caliphornia OS.",
};

function joinClasses(...classes: Array<string | undefined>) {
  return classes.filter(Boolean).join(" ");
}
function joinClasses(...classes: Array<string | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function AccessWindow({
  projectSlug = "music",
  projectName,
  children,
  className = "",
  triggerClassName = "",
  triggerImgClassName = "",
  triggerLabel = "Open access window",
}: AccessWindowProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [autoRenew, setAutoRenew] = useState(false);
  const [error, setError] = useState("");

  const normalizedProjectSlug = projectSlug.trim().toLowerCase();

  const project = useMemo(() => {
    const copy = PROJECT_COPY[normalizedProjectSlug] || FALLBACK_PROJECT;

    return {
      ...copy,
      name: projectName || copy.name,
    };
  }, [normalizedProjectSlug, projectName]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
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
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          plan,
          projectSlug: normalizedProjectSlug,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data?.ok || !data?.url) {
        throw new Error(data?.error || "Checkout could not be started.");
      }

      window.location.href = data.url;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Checkout could not be started.";
      setError(message);
      setIsCheckingOut(false);
    }
  }

  const passPlan: AccessPlan = autoRenew
    ? "supporter_subscription"
    : "kiiku_pass_30d";

  const modal = (
    <div
      className="access-window-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          setIsOpen(false);
        }
      }}
    >
      <section
        className="access-window-card"
        role="dialog"
        aria-modal="true"
        aria-label="Kiiku Credits access window"
      >
        <div className="access-window-topbar">
          <div>
            <p className="access-window-kicker">Kiiku Engine</p>
            <h2>Kiiku Credits</h2>
          </div>

          <button
            type="button"
            className="access-window-close"
            aria-label="Close access window"
            onClick={() => setIsOpen(false)}
          >
            ×
          </button>
        </div>

        <div className="kiiku-album-card">
          <div className="kiiku-album-main">
            <div className="kiiku-app-icon-wrap">
              <img src={project.icon} alt="" className="kiiku-app-icon" />
            </div>

            <div className="kiiku-album-copy">
              <p className="kiiku-label">Album unlock</p>
              <h3>{project.name}</h3>
              <p>{project.unlockLine}</p>
            </div>

            <div className="kiiku-credit-pill">
              <strong>{project.creditCost}</strong>
              <span>Kiiku Credits</span>
            </div>
          </div>

          <p className="kiiku-album-details">{project.details}</p>

          <button
            type="button"
            className="kiiku-primary-btn"
            disabled={isCheckingOut}
            onClick={() => startCheckout("project")}
          >
            {isCheckingOut
              ? "Opening Checkout..."
              : `Unlock with ${project.creditCost} Kiiku Credits`}
            <span>{project.price}</span>
          </button>
        </div>

        <div className="kiiku-pass-card">
          <div className="kiiku-pass-header">
            <div>
              <p className="kiiku-label">Full OS access</p>
              <h3>Kiiku Pass</h3>
              <p>
                Listening credits for the full Caliphornia OS experience across
                every current project.
              </p>
            </div>

            <div className="kiiku-pass-price">
              <strong>4</strong>
              <span>Kiiku Credits</span>
            </div>
          </div>

          <div className="kiiku-pass-panel">
            <div>
              <p className="kiiku-pass-mode">
                {autoRenew ? "Monthly auto-renew" : "30-day access"}
              </p>
              <p className="kiiku-pass-small">
                {autoRenew
                  ? "Keeps full access active every month until canceled."
                  : "Unlocks full access for 30 days. No monthly charge unless you turn on auto-renew."}
              </p>
            </div>

            <button
              type="button"
              className={`kiiku-toggle ${autoRenew ? "is-on" : ""}`}
              aria-pressed={autoRenew}
              onClick={() => setAutoRenew((value) => !value)}
            >
              <span />
            </button>
          </div>

          <ul className="kiiku-benefits">
            <li>Full songs across current Caliphornia OS projects</li>
            <li>Lyrics, notes, messages, games, and hidden project layers</li>
            <li>Early access language we can expand into email reminders later</li>
          </ul>

          <button
            type="button"
            className="kiiku-pass-btn"
            disabled={isCheckingOut}
            onClick={() => startCheckout(passPlan)}
          >
            {isCheckingOut
              ? "Opening Checkout..."
              : autoRenew
                ? "Start Monthly Kiiku Pass"
                : "Start 30-Day Kiiku Pass"}
            <span>{autoRenew ? "$3.99/mo" : "$3.99"}</span>
          </button>
        </div>

        {error ? <p className="access-window-error">{error}</p> : null}

        <p className="kiiku-legal">
          Kiiku means listen. Kiiku Credits are listening credits used only
          inside Caliphornia OS. They are not cash, not crypto, not transferable,
          and not redeemable for money.
        </p>
      </section>
    </div>
  );

  return (
    <>
      <button
  type="button"
  className={joinClasses(
    "access-window-trigger",
    className,
    triggerClassName
  )}
  aria-label={triggerLabel}
  onClick={() => setIsOpen(true)}
>
  {children || (
    <img src={project.icon} alt="" className={triggerImgClassName} />
  )}
</button>

      {mounted && isOpen ? createPortal(modal, document.body) : null}
    </>
  );
}
