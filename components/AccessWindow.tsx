"use client";

import { useEffect, useMemo, useState } from "react";

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
    description: string;
    ownLine: string;
    unlocks: string[];
  }
> = {
  fartherhood: {
    name: "FarTHErHOOD",
    shortName: "FarTHErHOOD",
    description:
      "Unlock the full notes, full songs, lyrics, and the complete fatherhood experience.",
    ownLine: "Own the full FarTHErHOOD experience forever.",
    unlocks: [
      "Full songs from the FarTHErHOOD project",
      "Full lyrics and transcripts",
      "Full note/story experience",
      "Future connected games and project extras",
    ],
  },
  friends: {
    name: "Fri.ends",
    shortName: "Fri.ends",
    description:
      "Unlock the full conversation experience, all audio bubbles, final songs, and connected music moments.",
    ownLine: "Own the full Fri.ends experience forever.",
    unlocks: [
      "Full conversation threads",
      "All song versions and audio bubbles",
      "Final songs from the project",
      "Future connected games and project extras",
    ],
  },
  milia: {
    name: "Milia",
    shortName: "Milia",
    description:
      "Unlock the full weather-based music experience, full songs, and project-connected features.",
    ownLine: "Own the full Milia experience forever.",
    unlocks: [
      "Full songs inside Milia",
      "Full weather/music experience",
      "Project-connected song access",
      "Future connected games and project extras",
    ],
  },
  music: {
    name: "Music",
    shortName: "Music",
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
  const [notice, setNotice] = useState("");

  const copy = useMemo(() => {
    const base = PROJECT_COPY[projectSlug] || PROJECT_COPY.music;
    return projectName ? { ...base, name: projectName, shortName: projectName } : base;
  }, [projectSlug, projectName]);

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

  function showStripeNotice(plan: "project" | "supporter") {
    if (plan === "project") {
      setNotice(
        `Next we will connect this button to Stripe so users can own ${copy.shortName} for $4.99.`
      );
      return;
    }

    setNotice(
      "Next we will connect this button to Stripe so users can subscribe for $3.99/month and unlock all current projects."
    );
  }

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

      {open ? (
        <div className="access-window-overlay" role="presentation">
          <button
            type="button"
            className="access-window-backdrop"
            aria-label="Close access window"
            onClick={() => setOpen(false)}
          />

          <section
            className="access-window-panel"
            role="dialog"
            aria-modal="true"
            aria-label={`Unlock ${copy.name}`}
          >
            <div className="access-window-handle" />

            <div className="access-window-topline">
              <div>
                <p className="access-window-kicker">Access</p>
                <h2>Unlock {copy.name}</h2>
              </div>

              <button
                type="button"
                className="access-window-close"
                aria-label="Close"
                onClick={() => setOpen(false)}
              >
                ×
              </button>
            </div>

            <p className="access-window-intro">{copy.description}</p>

            <div className="access-window-current">
              <span className="access-window-current-pill">Free Preview</span>
              <p>
                You can open the app, hear 30-second previews, and experience the free full song.
                Unlock to get the complete project.
              </p>
            </div>

            <div className="access-window-plans">
              <article className="access-plan-card access-plan-featured">
                <div className="access-plan-head">
                  <div>
                    <p className="access-plan-label">Own this experience</p>
                    <h3>{copy.shortName}</h3>
                  </div>
                  <div className="access-plan-price">$4.99</div>
                </div>

                <p className="access-plan-copy">{copy.ownLine}</p>

                <ul className="access-plan-list">
                  {copy.unlocks.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>

                <button
                  type="button"
                  className="access-plan-btn"
                  onClick={() => showStripeNotice("project")}
                >
                  Own {copy.shortName}
                </button>

                <p className="access-plan-footnote">
                  Subscriber discount later: $2.99 project unlock.
                </p>
              </article>

              <article className="access-plan-card">
                <div className="access-plan-head">
                  <div>
                    <p className="access-plan-label">Unlock everything</p>
                    <h3>Supporter Pass</h3>
                  </div>
                  <div className="access-plan-price">$3.99/mo</div>
                </div>

                <p className="access-plan-copy">
                  Unlock all current projects while subscribed, including Milia, Fri.ends,
                  FarTHErHOOD, Music, playlists, games, and future app experiences.
                </p>

                <ul className="access-plan-list">
                  <li>Full access across current projects</li>
                  <li>Full songs while subscribed</li>
                  <li>Full lyrics, conversations, notes, and app experiences</li>
                  <li>Support pushes music toward wider release</li>
                </ul>

                <button
                  type="button"
                  className="access-plan-btn secondary"
                  onClick={() => showStripeNotice("supporter")}
                >
                  Join Supporter Pass
                </button>
              </article>
            </div>

            {notice ? <p className="access-window-notice">{notice}</p> : null}
          </section>
        </div>
      ) : null}
    </>
  );
}
