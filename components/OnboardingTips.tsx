"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";

type Tip = {
  title: string;
  body: string;
  actionLabel?: string;
  actionHref?: string;
};

const TIP_SETS: Array<{ match: RegExp; key: string; tips: Tip[] }> = [
  {
    key: "root",
    match: /^\/$/,
    tips: [
      {
        title: "Welcome to Caliphornia OS",
        body:
          "This is the public entry screen. You can sign in, or receive a nearby Share if someone close to you is sending music.",
      },
      {
        title: "Receiving music nearby",
        body:
          "When a sender starts Share near you, a Receive card can appear here. Tap it to accept one guest listen without making an account first.",
      },
    ],
  },
  {
    key: "home",
    match: /^\/home$/,
    tips: [
      {
        title: "Your OS home screen",
        body:
          "Tap an app icon to enter a project or tool. The dock keeps Music, Stats, Share, and Account close by.",
      },
      {
        title: "Unlocks follow you",
        body:
          "Any songs, projects, passes, Kiiku, and shares stay connected to this account as you move through the OS.",
        actionLabel: "Open Account",
        actionHref: "/apps/account",
      },
    ],
  },
  {
    key: "share",
    match: /^\/apps\/share/,
    tips: [
      {
        title: "Share is proximity-first",
        body:
          "Choose a song or project, start Share, and stay close. A nearby receiver can accept from the main Caliphornia OS page.",
      },
      {
        title: "Project shares",
        body:
          "When you share a full project, the receiver gets one guest listen for each song included in that project.",
        actionLabel: "View sharing stats",
        actionHref: "/apps/stats",
      },
    ],
  },
  {
    key: "account",
    match: /^\/apps\/(account|wallet)/,
    tips: [
      {
        title: "Account and Wallet are one app",
        body:
          "Profile, Kiiku, access, billing, purchases, and shares now live together in the Apple Settings-style Account app.",
      },
      {
        title: "Kiiku stays internal",
        body:
          "Kiiku is participation credit inside Caliphornia OS. It helps unlock and reward listening behavior, but it is not cash or crypto.",
      },
    ],
  },
  {
    key: "music",
    match: /^\/apps\/music/,
    tips: [
      {
        title: "Music library",
        body:
          "Songs you save, unlock, or claim from Share collect here. The global player follows you across the OS.",
      },
    ],
  },
  {
    key: "stats",
    match: /^\/apps\/stats/,
    tips: [
      {
        title: "Activity-style Stats",
        body:
          "Stats shows your listening, favorites, app activity, places, rankings, and now sharing performance.",
      },
      {
        title: "Sharing changes the system",
        body:
          "Share stats show top sharers, most shared songs, project shares, accepted transfers, and new accounts created from sharing.",
      },
    ],
  },
  {
    key: "calendar",
    match: /^\/apps\/calendar/,
    tips: [
      {
        title: "Release calendar",
        body:
          "Dots mark songs, projects, merch, videos, and app moments. Tap a marked date to open the release sheet.",
      },
    ],
  },
  {
    key: "fartherhood",
    match: /^\/apps\/fartherhood/,
    tips: [
      {
        title: "FarTHErHOOD Notes",
        body:
          "This project behaves like a Notes app: songs, lyrics, thoughts, and story layers sit inside the project world.",
      },
    ],
  },
  {
    key: "friends",
    match: /^\/apps\/friends/,
    tips: [
      {
        title: "fri.ends Messages",
        body:
          "This project behaves like a text thread. Conversations, audio bubbles, and final songs connect inside the Messages-style world.",
      },
    ],
  },
  {
    key: "milia",
    match: /^\/apps\/milia/,
    tips: [
      {
        title: "Milia Weather",
        body:
          "Milia uses a Weather-style interface where songs feel like emotional forecasts tied to places and conditions.",
      },
    ],
  },
  {
    key: "guest",
    match: /^\/guest/,
    tips: [
      {
        title: "Guest listening",
        body:
          "You received a shared listen. Finish the play, then enter your email only if you want to keep it in your Music library.",
      },
    ],
  },
];

const DEFAULT_TIPS: Tip[] = [
  {
    title: "Caliphornia OS",
    body:
      "Use the app controls, Share, Account, and the global player to move through this release world.",
  },
];

function storageKey(key: string) {
  return `caliphornia:onboarding:v2:${key}`;
}

export default function OnboardingTips() {
  const pathname = usePathname() || "/";
  const tipSet = useMemo(() => {
    return TIP_SETS.find((item) => item.match.test(pathname)) || {
      key: "default",
      tips: DEFAULT_TIPS,
    };
  }, [pathname]);

  const [index, setIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setIndex(0);

    try {
      const seen = window.localStorage.getItem(storageKey(tipSet.key));
      setIsOpen(!seen);
    } catch {
      setIsOpen(false);
    }
  }, [tipSet.key]);

  const tips = tipSet.tips;
  const current = tips[index] || tips[0];
  const hasNext = index < tips.length - 1;

  function close() {
    try {
      window.localStorage.setItem(storageKey(tipSet.key), "seen");
    } catch {}
    setIsOpen(false);
  }

  function resetAll() {
    try {
      Object.keys(window.localStorage)
        .filter((key) => key.startsWith("caliphornia:onboarding:"))
        .forEach((key) => window.localStorage.removeItem(key));
    } catch {}
    setIndex(0);
    setIsOpen(true);
  }

  if (!mounted) return null;

  return (
    <>
      <style>{`
        .cos-help-button {
          position: fixed;
          left: max(12px, calc((100vw - var(--cos-app-max, 760px)) / 2 + 12px));
          bottom: calc(18px + env(safe-area-inset-bottom, 0px));
          z-index: 2600;
          width: 42px;
          height: 42px;
          border: 1px solid rgba(255,255,255,.14);
          border-radius: 999px;
          color: white;
          background: rgba(12,14,20,.68);
          box-shadow: 0 18px 46px rgba(0,0,0,.34), inset 0 1px 0 rgba(255,255,255,.08);
          backdrop-filter: blur(18px) saturate(150%);
          -webkit-backdrop-filter: blur(18px) saturate(150%);
          font-weight: 900;
          cursor: pointer;
        }
        .cos-onboarding-card {
          position: fixed;
          left: 50%;
          top: calc(env(safe-area-inset-top, 0px) + 16px);
          z-index: 2700;
          width: min(420px, calc(100vw - 24px));
          transform: translateX(-50%);
          border-radius: 28px;
          padding: 16px;
          color: #fff;
          background: linear-gradient(180deg, rgba(34,36,42,.94), rgba(9,10,14,.96));
          border: 1px solid rgba(255,255,255,.14);
          box-shadow: 0 28px 90px rgba(0,0,0,.48), inset 0 1px 0 rgba(255,255,255,.08);
          backdrop-filter: blur(26px) saturate(150%);
          -webkit-backdrop-filter: blur(26px) saturate(150%);
        }
        .cos-onboarding-topline {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 10px;
        }
        .cos-onboarding-topline span {
          color: #9ddcff;
          font-size: 11px;
          letter-spacing: .16em;
          text-transform: uppercase;
          font-weight: 900;
        }
        .cos-onboarding-topline button {
          width: 34px;
          height: 34px;
          border: 0;
          border-radius: 999px;
          color: white;
          background: rgba(255,255,255,.10);
          font-size: 24px;
          cursor: pointer;
        }
        .cos-onboarding-card h2 {
          margin: 0;
          font-size: 26px;
          line-height: 1;
          letter-spacing: -.05em;
        }
        .cos-onboarding-card p {
          margin: 10px 0 0;
          color: rgba(255,255,255,.72);
          font-size: 14px;
          line-height: 1.45;
        }
        .cos-onboarding-progress {
          display: flex;
          gap: 5px;
          margin-top: 14px;
        }
        .cos-onboarding-progress i {
          width: 7px;
          height: 7px;
          border-radius: 999px;
          background: rgba(255,255,255,.22);
        }
        .cos-onboarding-progress i.active {
          width: 22px;
          background: #9ddcff;
        }
        .cos-onboarding-actions {
          display: flex;
          gap: 8px;
          margin-top: 14px;
        }
        .cos-onboarding-actions a, .cos-onboarding-actions button {
          flex: 1;
          min-height: 44px;
          border: 0;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: #06111c;
          background: linear-gradient(180deg, #fff, #9ddcff);
          font-weight: 900;
          cursor: pointer;
          text-decoration: none;
        }
        .cos-onboarding-actions a + button {
          color: white;
          background: rgba(255,255,255,.12);
        }
        .cos-onboarding-reset {
          margin-top: 10px;
          border: 0;
          background: transparent;
          color: rgba(255,255,255,.54);
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
        }
        body.has-global-player .cos-help-button {
          bottom: calc(112px + env(safe-area-inset-bottom, 0px));
        }
        @media (max-width: 680px) {
          .cos-help-button {
            left: 10px;
            bottom: calc(16px + env(safe-area-inset-bottom, 0px));
          }
          body.has-global-player .cos-help-button {
            bottom: calc(106px + env(safe-area-inset-bottom, 0px));
          }
          .cos-onboarding-card {
            top: calc(env(safe-area-inset-top, 0px) + 10px);
          }
        }
      `}</style>
      <button
        type="button"
        className="cos-help-button"
        onClick={() => setIsOpen(true)}
        aria-label="Open Caliphornia OS guide"
      >
        ?
      </button>

      {isOpen ? (
        <div className="cos-onboarding-card" role="dialog" aria-live="polite">
          <div className="cos-onboarding-topline">
            <span>Guide</span>
            <button type="button" onClick={close} aria-label="Close guide">
              ×
            </button>
          </div>

          <h2>{current.title}</h2>
          <p>{current.body}</p>

          <div className="cos-onboarding-progress">
            {tips.map((_, dotIndex) => (
              <i key={dotIndex} className={dotIndex === index ? "active" : ""} />
            ))}
          </div>

          <div className="cos-onboarding-actions">
            {current.actionHref ? (
              <a href={current.actionHref}>{current.actionLabel || "Open"}</a>
            ) : null}
            {hasNext ? (
              <button type="button" onClick={() => setIndex((value) => value + 1)}>
                Next
              </button>
            ) : (
              <button type="button" onClick={close}>
                Got it
              </button>
            )}
          </div>

          <button type="button" className="cos-onboarding-reset" onClick={resetAll}>
            Replay tips everywhere
          </button>
        </div>
      ) : null}
    </>
  );
}
