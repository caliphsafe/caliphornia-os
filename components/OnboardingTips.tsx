"use client";

import { useEffect, useMemo, useState } from "react";

const pageTips: Record<string, string[]> = {
  "/home": ["This is your Caliphornia OS Home Screen.", "Open Music for your full library.", "Open Share to send songs to nearby listeners."],
  "/apps/music": ["Music is your central library.", "Favorite songs to build an editable playlist.", "Tap Share on any song to start a nearby transfer."],
  "/apps/share": ["Share sends songs or projects to nearby listeners.", "The receiver only opens Caliphornia OS and taps Receive when they are close."],
  "/apps/account": ["Account is your Settings app.", "Review Kiiku, access, shares, billing, and support in one place."],
  "/apps/stats": ["Stats shows your listening and global activity.", "Use the Share tab to see top sharers and most shared songs."],
  "/dashboard": ["Admin Control manages songs, apps, accounts, Kiiku, invites, blasts, payments, and Share."],
};

function tipsFor(pathname: string) {
  const exact = pageTips[pathname];
  if (exact) return exact;
  if (pathname.startsWith("/dashboard")) return pageTips["/dashboard"];
  if (pathname.startsWith("/apps/friends")) return ["Fri.ends works like Messages.", "Tap songs or audio bubbles to play.", "Use Share playing to send the current song nearby."];
  if (pathname.startsWith("/apps/fartherhood")) return ["FarTHErHOOD works like Notes.", "Open notes and songs from the project surface.", "Use Share playing to send the current song nearby."];
  if (pathname.startsWith("/apps/milia")) return ["Milia works like Weather.", "Open memories and tracks from the forecast cards.", "Use Share playing to send the current song nearby."];
  return ["Explore Caliphornia OS.", "Music, Share, Stats, Kiiku, and account access are connected across the platform."];
}

export default function OnboardingTips() {
  const [pathname, setPathname] = useState("");
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const path = window.location.pathname;
    setPathname(path);
    const key = `caliph:onboarded:${path}`;
    if (!localStorage.getItem(key)) setOpen(true);
  }, []);

  const tips = useMemo(() => tipsFor(pathname), [pathname]);
  const current = tips[index] || tips[0];

  function close() {
    localStorage.setItem(`caliph:onboarded:${pathname}`, "1");
    setOpen(false);
    setIndex(0);
  }

  if (!pathname) return null;

  return (
    <>
      <button type="button" className="cos-onboarding-help" onClick={() => setOpen(true)} aria-label="Show page tips">?</button>
      {open ? (
        <div className="cos-onboarding-card">
          <div>
            <span>First-time tip</span>
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
