"use client";

import { useEffect, useMemo, useState } from "react";

const pageTips: Record<string, string[]> = {
  "/home": ["This is your Caliphornia OS Home Screen.", "Open Music for your full library.", "Open Share to send songs to nearby listeners."],
  "/apps/music": ["Music is now your central iOS-style listening app.", "Favorites become an editable playlist.", "Tap Share on any song, or Share playing in the global player, to start a nearby transfer."],
  "/apps/share": ["Share sends songs or projects to nearby listeners.", "The receiver only opens Caliphornia OS and taps Receive when they are close."],
  "/apps/account": ["Account is your Settings app.", "Review Kiiku, access, shares, billing, and support in one place."],
  "/apps/stats": ["Stats shows your listening, global activity, and Share activity.", "Use the Share tab to see top sharers and most shared songs."],
  "/dashboard": ["Admin Control manages songs, apps, accounts, Kiiku, invites, blasts, payments, and Share.", "Open Accounts to grant full access, song access, project access, and Kiiku."],
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
  if (pageKey === "/apps/friends") return ["Fri.ends works like Messages.", "Tap songs or audio bubbles to play.", "Use the small Share icon or Share playing to send the current song nearby."];
  if (pageKey === "/apps/fartherhood") return ["FarTHErHOOD works like Notes.", "Open notes and songs from the project surface.", "Use the small Share icon or Share playing to send the current song nearby."];
  if (pageKey === "/apps/milia") return ["Milia works like Weather.", "Open memories and tracks from the forecast cards.", "Use the small Share icon or Share playing to send the current song nearby."];
  if (pageKey === "/guest") return ["This is a guest Share player.", "You get one full listen for each shared song.", "Claim the shared play after listening to keep it in Music."];
  return ["Explore Caliphornia OS.", "Music, Share, Stats, Kiiku, and account access are connected across the platform."];
}

export default function OnboardingTips() {
  const [pageKey, setPageKey] = useState("");
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [manual, setManual] = useState(false);

  useEffect(() => {
    const key = normalizePath(window.location.pathname);
    setPageKey(key);
    const storageKey = `caliph:onboarded:v3:${key}`;
    const hasSeen = localStorage.getItem(storageKey) === "1";
    if (!hasSeen) {
      setOpen(true);
      setManual(false);
    }
  }, []);

  const tips = useMemo(() => tipsFor(pageKey), [pageKey]);
  const current = tips[index] || tips[0];

  function close() {
    if (pageKey) localStorage.setItem(`caliph:onboarded:v3:${pageKey}`, "1");
    setOpen(false);
    setIndex(0);
    setManual(false);
  }

  function replay() {
    setIndex(0);
    setManual(true);
    setOpen(true);
  }

  if (!pageKey || pageKey === "/") return null;

  return (
    <>
      <button type="button" className="cos-onboarding-help" onClick={replay} aria-label="Show page tips">?</button>
      {open ? (
        <div className="cos-onboarding-card" data-manual={manual ? "true" : "false"}>
          <div>
            <span>{manual ? "Page help" : "First-time tip"}</span>
            <strong>{current}</strong>
          </div>
          <div className="cos-onboarding-actions">
            <button type="button" onClick={() => setIndex((value) => Math.max(0, value - 1))} disabled={index === 0}>Back</button>
            {index < tips.length - 1 ? <button type="button" onClick={() => setIndex((value) => value + 1)}>Next</button> : <button type="button" onClick={close}>Done</button>}
          </div>
        </div>
      ) : null}
    </>
  );
}
