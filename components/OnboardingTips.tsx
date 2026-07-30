"use client";

import { useMemo, useState } from "react";

const pageTips: Record<string, string[]> = {
  "/home": [
    "This is your Caliphornia OS Home Screen.",
    "Open Music for your complete library.",
    "Open Share to send songs to nearby listeners.",
  ],
  "/apps/music": [
    "Music is your central listening app.",
    "Favorites become an editable playlist.",
    "Use Share on a song to open it directly in the Share app.",
  ],
  "/apps/share": [
    "Share sends songs or projects to nearby listeners.",
    "Location is requested only when you start a proximity Share.",
  ],
  "/apps/account": [
    "Account is your Settings app.",
    "Review access, Kiiku, sharing, billing, and support here.",
  ],
  "/apps/stats": [
    "Stats connects listening and Share activity.",
    "Share appears before Rankings in the bottom navigation.",
  ],
  "/dashboard": [
    "Admin Control manages Caliphornia OS systems.",
    "Use each section for focused administrative work.",
  ],
};

function normalizePath(pathname: string) {
  if (pathname === "/") return "/";
  if (pathname.startsWith("/dashboard")) return "/dashboard";
  if (pathname.startsWith("/apps/friends")) return "/apps/friends";
  if (pathname.startsWith("/apps/fartherhood")) return "/apps/fartherhood";
  if (pathname.startsWith("/apps/milia")) return "/apps/milia";
  if (pathname.startsWith("/guest")) return "/guest";
  return pathname.replace(/\/$/, "");
}

function tipsFor(pageKey: string) {
  const exact = pageTips[pageKey];
  if (exact) return exact;

  if (pageKey === "/apps/friends") {
    return [
      "Fri.ends works like Messages.",
      "Tap an audio bubble to play it.",
      "Use the Share action beside each song to open it in Share.",
    ];
  }

  if (pageKey === "/apps/fartherhood") {
    return [
      "FarTHErHOOD works like Notes.",
      "Open a song note for lyrics and details.",
      "Use Share beside every song to open it in Share.",
    ];
  }

  if (pageKey === "/apps/milia") {
    return [
      "Milia works like Weather.",
      "Open forecast cards to explore songs and memories.",
      "Use Share on every song card to open it in Share.",
    ];
  }

  if (pageKey === "/guest") {
    return [
      "This is a guest Share player.",
      "A shared song includes one full guest listen.",
      "Claim the experience afterward to keep it in Music.",
    ];
  }

  return [
    "Explore Caliphornia OS.",
    "Music, Share, Stats, Kiiku, and account access are connected.",
  ];
}

export default function OnboardingTips() {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);

  const pageKey =
    typeof window === "undefined"
      ? ""
      : normalizePath(window.location.pathname);

  const tips = useMemo(() => tipsFor(pageKey), [pageKey]);
  const current = tips[index] || tips[0];

  function showHelp() {
    setIndex(0);
    setOpen(true);
  }

  function close() {
    setOpen(false);
    setIndex(0);
  }

  if (!pageKey || pageKey === "/") return null;

  return (
    <>
      <button
        type="button"
        className="cos-onboarding-help"
        onClick={showHelp}
        aria-label="Show page tips"
        aria-expanded={open}
      >
        ?
      </button>

      {open ? (
        <aside className="cos-onboarding-card" aria-live="polite">
          <div className="cos-onboarding-copy">
            <span>Page help</span>
            <strong>{current}</strong>
          </div>

          <div className="cos-onboarding-actions">
            <button
              type="button"
              onClick={() => setIndex((value) => Math.max(0, value - 1))}
              disabled={index === 0}
            >
              Back
            </button>

            {index < tips.length - 1 ? (
              <button
                type="button"
                onClick={() => setIndex((value) => value + 1)}
              >
                Next
              </button>
            ) : (
              <button type="button" onClick={close}>
                Done
              </button>
            )}
          </div>
        </aside>
      ) : null}
    </>
  );
}
