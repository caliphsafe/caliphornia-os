"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

type AccessProjectSlug = "fartherhood" | "friends" | "milia" | "music";

type AccessWindowProps = {
  projectSlug: AccessProjectSlug;
  projectName?: string;
  triggerClassName?: string;
  triggerImgClassName?: string;
  triggerLabel?: string;
};

const PROJECT_COPY: Record<
  AccessProjectSlug,
  {
    name: string;
    shortName: string;
    icon: string;
    accent: string;
    description: string;
    ownLine: string;
    unlocks: string[];
  }
> = {
  fartherhood: {
    name: "FarTHErHOOD",
    shortName: "FarTHErHOOD",
    icon: "/apps/fartherhood/icon.png",
    accent: "Warm Notes",
    description:
      "Unlock the full notes, full songs, lyrics, and the complete fatherhood experience.",
    ownLine: "Own the full FarTHErHOOD experience forever.",
    unlocks: [
      "Full songs from the project",
      "Lyrics and transcripts",
      "Full note and story experience",
      "Connected games and future extras",
    ],
  },
  friends: {
    name: "Fri.ends",
    shortName: "Fri.ends",
    icon: "/apps/friends/icon.png",
    accent: "Conversation Pass",
    description:
      "Unlock the full conversation experience, all audio bubbles, final songs, and connected music moments.",
    ownLine: "Own the full Fri.ends experience forever.",
    unlocks: [
      "Full conversation threads",
      "All song versions and audio bubbles",
      "Final songs from the project",
      "Connected games and future extras",
    ],
  },
  milia: {
    name: "Milia",
    shortName: "Milia",
    icon: "/apps/milia/icon.png",
    accent: "Weather Music",
    description:
      "Unlock the full weather-based music experience, full songs, and project-connected features.",
    ownLine: "Own the full Milia experience forever.",
    unlocks: [
      "Full songs inside Milia",
      "Full weather and music experience",
      "Project-connected song access",
      "Connected games and future extras",
    ],
  },
  music: {
    name: "Music",
    shortName: "Music",
    icon: "/icons/access.png",
    accent: "Full Library",
    description:
      "Unlock the full listening library, playlists, favorites, and connected platform features.",
    ownLine: "Unlock the full music library experience.",
    unlocks: [
      "Full eligible songs",
      "Playlists and favorites",
      "Library access across projects",
      "Future connected listening tools",
    ],
  },
};

export default function AccessWindow({
  projectSlug,
  projectName,
  triggerClassName = "",
  triggerImgClassName = "",
  triggerLabel,
}: AccessWindowProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [notice, setNotice] = useState("");

  const copy = useMemo(() => {
    const base = PROJECT_COPY[projectSlug] || PROJECT_COPY.music;
    return projectName ? { ...base, name: projectName, shortName: projectName } : base;
  }, [projectSlug, projectName]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.body.classList.add("access-window-lock");
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.classList.remove("access-window-lock");
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function closeWindow() {
    setOpen(false);
    setNotice("");
  }

  function showStripeNotice(plan: "project" | "supporter") {
    if (plan === "project") {
      setNotice(
        `Stripe checkout will connect here next: own ${copy.shortName} for $4.99.`
      );
      return;
    }

    setNotice(
      "Stripe checkout will connect here next: subscribe for $3.99/month and unlock all current projects."
    );
  }

  const modal = open ? (
    <div className="access-window-overlay" role="presentation">
      <button
        type="button"
        className="access-window-backdrop"
        aria-label="Close access window"
        onClick={closeWindow}
      />

      <section
        className="access-wallet-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={`Unlock ${copy.name}`}
      >
        <div className="access-wallet-handle" />

        <div className="access-wallet-topbar">
          <button
            type="button"
            className="access-wallet-cancel"
            onClick={closeWindow}
          >
            Cancel
          </button>

          <div className="access-wallet-title">Access Pass</div>

          <button
            type="button"
            className="access-wallet-done"
            onClick={closeWindow}
            aria-label="Close"
          >
            Done
          </button>
        </div>

        <div className="access-wallet-card">
          <div className="access-wallet-card-shine" />

          <div className="access-wallet-card-top">
            <div className="access-wallet-app-icon">
              <img src={copy.icon} alt="" aria-hidden="true" />
            </div>

            <div className="access-wallet-card-copy">
              <p>{copy.accent}</p>
              <h2>{copy.name}</h2>
            </div>
          </div>

          <div className="access-wallet-card-bottom">
            <div>
              <span>Free Preview</span>
              <strong>Upgrade available</strong>
            </div>

            <img
              src="/icons/access.png"
              alt=""
              aria-hidden="true"
              className="access-wallet-mark"
            />
          </div>
        </div>

        <p className="access-wallet-intro">{copy.description}</p>

        <div className="access-wallet-plan-list">
          <article className="access-wallet-plan is-primary">
            <div className="access-wallet-plan-head">
              <div>
                <p>Own this experience</p>
                <h3>{copy.shortName}</h3>
              </div>

              <div className="access-wallet-price">$4.99</div>
            </div>

            <p className="access-wallet-plan-copy">{copy.ownLine}</p>

            <div className="access-wallet-unlocks">
              {copy.unlocks.map((item) => (
                <div key={item} className="access-wallet-unlock-row">
                  <span>✓</span>
                  <p>{item}</p>
                </div>
              ))}
            </div>

            <button
              type="button"
              className="access-wallet-pay-btn"
              onClick={() => showStripeNotice("project")}
            >
              Own {copy.shortName}
            </button>

            <div className="access-wallet-mini-note">
              Subscriber discount later: $2.99 project unlock.
            </div>
          </article>

          <article className="access-wallet-plan">
            <div className="access-wallet-plan-head">
              <div>
                <p>Unlock everything</p>
                <h3>Supporter Pass</h3>
              </div>

              <div className="access-wallet-price">$3.99/mo</div>
            </div>

            <p className="access-wallet-plan-copy">
              Unlock all current projects while subscribed, including Milia,
              Fri.ends, FarTHErHOOD, Music, playlists, games, and future app experiences.
            </p>

            <div className="access-wallet-unlocks">
              <div className="access-wallet-unlock-row">
                <span>✓</span>
                <p>All current project experiences</p>
              </div>
              <div className="access-wallet-unlock-row">
                <span>✓</span>
                <p>Full songs while subscribed</p>
              </div>
              <div className="access-wallet-unlock-row">
                <span>✓</span>
                <p>Lyrics, conversations, notes, playlists, and games</p>
              </div>
            </div>

            <button
              type="button"
              className="access-wallet-pay-btn secondary"
              onClick={() => showStripeNotice("supporter")}
            >
              Join Supporter Pass
            </button>
          </article>
        </div>

        {notice ? <p className="access-wallet-notice">{notice}</p> : null}
      </section>
    </div>
  ) : null;

  return (
    <>
      <button
        type="button"
        className={["access-window-trigger", triggerClassName].filter(Boolean).join(" ")}
        aria-label={`Open access options for ${copy.name}`}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setNotice("");
          setOpen(true);
        }}
      >
        {triggerLabel ? (
          <span>{triggerLabel}</span>
        ) : (
          <img
            src="/icons/access.png"
            alt=""
            aria-hidden="true"
            className={["access-window-trigger-icon", triggerImgClassName]
              .filter(Boolean)
              .join(" ")}
          />
        )}
      </button>

      {mounted && modal ? createPortal(modal, document.body) : null}
    </>
  );
}