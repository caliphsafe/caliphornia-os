"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type ScreenStep = "locked" | "form";

function getFormattedTime(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

function getFormattedDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric"
  }).format(date);
}

function normalizeUsername(value: string) {
  return value
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 30);
}

function isValidUsername(value: string) {
  return /^[a-zA-Z0-9_]{3,30}$/.test(value);
}

export default function EmailWall() {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [step, setStep] = useState<ScreenStep>("locked");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [now, setNow] = useState(new Date());

  const trackRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);
  const startXRef = useRef(0);
  const startLeftRef = useRef(0);

  const [knobLeft, setKnobLeft] = useState(8);
  const [trackWidth, setTrackWidth] = useState(0);
  const [isUnlockedAnim, setIsUnlockedAnim] = useState(false);

  const knobSize = 60;

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    function updateTrackWidth() {
      if (!trackRef.current) return;
      setTrackWidth(trackRef.current.offsetWidth);
    }

    updateTrackWidth();
    window.addEventListener("resize", updateTrackWidth);
    return () => window.removeEventListener("resize", updateTrackWidth);
  }, []);

  const maxLeft = useMemo(() => {
    return Math.max(8, trackWidth - knobSize - 8);
  }, [trackWidth]);

  const progress = useMemo(() => {
    const range = Math.max(1, maxLeft - 8);
    return Math.max(0, Math.min(1, (knobLeft - 8) / range));
  }, [knobLeft, maxLeft]);

  useEffect(() => {
    if (step === "locked") {
      setKnobLeft(8);
      setIsUnlockedAnim(false);
    }
  }, [step]);

  function beginDrag(clientX: number) {
    draggingRef.current = true;
    startXRef.current = clientX;
    startLeftRef.current = knobLeft;
  }

  function moveDrag(clientX: number) {
    if (!draggingRef.current) return;
    const delta = clientX - startXRef.current;
    const next = Math.min(maxLeft, Math.max(8, startLeftRef.current + delta));
    setKnobLeft(next);
  }

  function endDrag() {
    if (!draggingRef.current) return;
    draggingRef.current = false;

    const unlockThreshold = maxLeft * 0.74;
    if (knobLeft >= unlockThreshold) {
      setKnobLeft(maxLeft);
      setIsUnlockedAnim(true);

      window.setTimeout(() => {
        setStep("form");
        setKnobLeft(8);
        setIsUnlockedAnim(false);
      }, 180);
    } else {
      setKnobLeft(8);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const cleanUsername = normalizeUsername(username);

    if (!isValidUsername(cleanUsername)) {
      setLoading(false);
      setError("Username must be 3 to 30 characters and use only letters, numbers, or underscores.");
      return;
    }

    const res = await fetch("/api/access", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email,
        username: cleanUsername
      })
    });

    const data = await res.json();
    setLoading(false);

    if (!data.ok) {
      setError(data.error || "Unable to continue.");
      return;
    }

    window.location.href = "/home";
  }

  return (
  <div
    className="lock-screen-panel ios-lock-shell"
    style={{ height: "100dvh", overflow: "hidden", touchAction: "none" }}
  >
      <div className="lock-wallpaper-glow" />
      <div className="lock-noise" />

      {step === "locked" ? (
        <>
          <div className={`lock-screen-content ${isUnlockedAnim ? "is-unlocking" : ""}`}>
            <div className="lock-date-top">{getFormattedDate(now)}</div>
            <div className="lock-time-live">{getFormattedTime(now)}</div>

            <div className="lock-screen-center-copy">
              <p>Caliphornia OS</p>
              <span>Music, worlds, stories, and apps connected in one place.</span>
            </div>
          </div>

          <div className="unlock-area">
            <div
              ref={trackRef}
              className="unlock-track"
              onPointerMove={(e) => moveDrag(e.clientX)}
              onPointerUp={endDrag}
              onPointerLeave={endDrag}
            >
              <div
                className="unlock-track-glow"
                style={{
                  opacity: 0.25 + progress * 0.55
                }}
              />

              <button
                type="button"
                className="unlock-knob"
                style={{
                  left: `${knobLeft}px`,
                  transform: `scale(${1 + progress * 0.04})`
                }}
                onPointerDown={(e) => beginDrag(e.clientX)}
                aria-label="Swipe to unlock"
              >
                <span className="unlock-knob-arrow">→</span>
              </button>

              <div
                className="unlock-fill"
                style={{ width: `${Math.min(knobLeft + knobSize, trackWidth - 8)}px` }}
              />

              <div
                className="unlock-text"
                style={{
                  opacity: Math.max(0, 1 - progress * 1.3),
                  transform: `translateY(${progress * -2}px)`
                }}
              >
                Swipe to enter
              </div>
            </div>
          </div>
        </>
      ) : (
        <form className="email-card ios-email-card" onSubmit={handleSubmit}>
          <div className="email-card-top">
            <div className="mini-pill" />
            <h2>Create your access</h2>
            <p>
              Enter your email and choose a username to unlock your apps, playlists, lyrics,
              releases, and future drops.
            </p>
          </div>

          <div className="form-stack">
            <label className="wall-field">
              <span>Email</span>
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="email-input"
                required
              />
            </label>

            <label className="wall-field">
              <span>Username</span>
              <input
                type="text"
                autoComplete="username"
                placeholder="choose_a_username"
                value={username}
                onChange={(e) => setUsername(normalizeUsername(e.target.value))}
                className="email-input"
                required
              />
              <small className="wall-help">
                3 to 30 characters. Letters, numbers, and underscores only.
              </small>
            </label>
          </div>

          {error ? <p className="form-error">{error}</p> : null}

          <button className="primary-btn" type="submit" disabled={loading}>
            {loading ? "Entering..." : "Enter Home Screen"}
          </button>

          <button
            type="button"
            className="ghost-btn"
            onClick={() => {
              setStep("locked");
              setError("");
            }}
          >
            Back to Lock Screen
          </button>
        </form>
      )}

      <style jsx>{`
        .lock-screen-panel {
  position: relative;
  height: 100dvh;
  min-height: 100dvh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  box-sizing: border-box;
  padding: max(18px, env(safe-area-inset-top)) 16px max(18px, env(safe-area-inset-bottom));
  color: #fff;
}

        .lock-wallpaper-glow {
          position: absolute;
          inset: 0;
          background:
            radial-gradient(circle at 20% 20%, rgba(102, 163, 255, 0.22), transparent 26%),
            radial-gradient(circle at 80% 24%, rgba(255, 120, 195, 0.18), transparent 24%),
            radial-gradient(circle at 50% 80%, rgba(104, 255, 211, 0.12), transparent 28%);
          pointer-events: none;
        }

        .lock-noise {
          position: absolute;
          inset: 0;
          pointer-events: none;
          opacity: 0.04;
          background-image:
            linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px);
          background-size: 4px 4px;
          mix-blend-mode: soft-light;
        }

        .lock-screen-content {
  position: relative;
  z-index: 2;
  text-align: center;
  margin-bottom: clamp(20px, 4vh, 42px);
  transition: transform 180ms ease, opacity 180ms ease;
}
        .lock-screen-content.is-unlocking {
          transform: scale(1.02) translateY(-4px);
          opacity: 0.9;
        }

        .lock-date-top {
          font-size: 20px;
          font-weight: 500;
          opacity: 0.9;
          margin-bottom: 8px;
        }

        .lock-time-live {
          font-size: clamp(68px, 18vw, 108px);
          line-height: 0.95;
          font-weight: 300;
          letter-spacing: -0.04em;
          margin-bottom: 24px;
          text-shadow: 0 12px 30px rgba(0, 0, 0, 0.22);
        }

        .lock-screen-center-copy p {
          margin: 0 0 8px;
          font-size: 14px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          opacity: 0.92;
        }

        .lock-screen-center-copy span {
          display: block;
          max-width: 420px;
          margin: 0 auto;
          font-size: 14px;
          line-height: 1.5;
          opacity: 0.7;
        }

        .unlock-area {
  position: relative;
  z-index: 2;
  width: min(520px, calc(100vw - 24px));
  flex-shrink: 0;
}

        .unlock-track {
          position: relative;
          height: 72px;
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,0.16);
          background:
            linear-gradient(180deg, rgba(255,255,255,0.12), rgba(255,255,255,0.04)),
            rgba(9, 18, 32, 0.62);
          backdrop-filter: blur(24px) saturate(160%);
          -webkit-backdrop-filter: blur(24px) saturate(160%);
          box-shadow:
            0 20px 40px rgba(0,0,0,0.22),
            inset 0 1px 0 rgba(255,255,255,0.08);
          overflow: hidden;
          touch-action: none;
        }

        .unlock-track-glow {
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02));
          pointer-events: none;
        }

        .unlock-fill {
          position: absolute;
          left: 8px;
          top: 8px;
          bottom: 8px;
          border-radius: 999px;
          background:
            linear-gradient(90deg, rgba(255,255,255,0.26), rgba(255,255,255,0.1));
          transition: width 120ms ease;
          pointer-events: none;
        }

        .unlock-text {
          position: absolute;
          inset: 0;
          display: grid;
          place-items: center;
          font-size: 15px;
          font-weight: 600;
          letter-spacing: 0.01em;
          pointer-events: none;
          transition: opacity 120ms ease, transform 120ms ease;
          text-shadow: 0 1px 1px rgba(0,0,0,0.18);
        }

        .unlock-knob {
          position: absolute;
          top: 6px;
          width: 60px;
          height: 60px;
          border: 0;
          border-radius: 999px;
          background:
            linear-gradient(180deg, rgba(255,255,255,0.98), rgba(235,241,248,0.88));
          color: #0b1424;
          display: grid;
          place-items: center;
          box-shadow:
            0 14px 30px rgba(0,0,0,0.2),
            inset 0 1px 0 rgba(255,255,255,0.95);
          cursor: grab;
          touch-action: none;
        }

        .unlock-knob:active {
          cursor: grabbing;
        }

        .unlock-knob-arrow {
          font-size: 22px;
          font-weight: 700;
          transform: translateX(1px);
        }

        .email-card {
  position: relative;
  z-index: 2;
  width: min(460px, calc(100vw - 24px));
  box-sizing: border-box;
  border-radius: 28px;
  border: 1px solid rgba(255,255,255,0.14);
  background:
    linear-gradient(180deg, rgba(255,255,255,0.14), rgba(255,255,255,0.05)),
    rgba(8, 17, 29, 0.76);
  backdrop-filter: blur(26px) saturate(160%);
  -webkit-backdrop-filter: blur(26px) saturate(160%);
  box-shadow:
    0 24px 50px rgba(0,0,0,0.28),
    inset 0 1px 0 rgba(255,255,255,0.1);
  padding: 20px;
}

        .email-card-top {
          text-align: center;
          margin-bottom: 16px;
        }

        .mini-pill {
          width: 52px;
          height: 6px;
          border-radius: 999px;
          background: rgba(255,255,255,0.16);
          margin: 0 auto 14px;
        }

        .email-card-top h2 {
          margin: 0 0 8px;
          font-size: 26px;
        }

        .email-card-top p {
          margin: 0;
          font-size: 14px;
          line-height: 1.55;
          opacity: 0.78;
        }

        .form-stack {
          display: grid;
          gap: 14px;
          margin-bottom: 14px;
        }

        .wall-field {
          display: grid;
          gap: 8px;
        }

        .wall-field span {
          font-size: 13px;
          opacity: 0.78;
        }

        .email-input {
          width: 100%;
          min-height: 52px;
          border-radius: 16px;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.07);
          color: #fff;
          padding: 0 14px;
          font-size: 16px;
          outline: none;
        }

        .email-input::placeholder {
          color: rgba(255,255,255,0.45);
        }

        .wall-help {
          font-size: 12px;
          opacity: 0.6;
          line-height: 1.4;
        }

        .form-error {
          margin: 0 0 14px;
          font-size: 13px;
          line-height: 1.45;
          color: #ffb6c1;
        }

        .primary-btn,
        .ghost-btn {
          width: 100%;
          min-height: 48px;
          border-radius: 16px;
          border: 1px solid rgba(255,255,255,0.12);
          padding: 0 14px;
          font-size: 15px;
          cursor: pointer;
        }

        .primary-btn {
          background: rgba(255,255,255,0.96);
          color: #08111d;
          font-weight: 700;
          margin-bottom: 10px;
        }

        .ghost-btn {
          background: rgba(255,255,255,0.08);
          color: #fff;
        }

        @media (max-width: 640px) {
  .lock-screen-panel {
    padding:
      max(12px, env(safe-area-inset-top))
      12px
      max(12px, env(safe-area-inset-bottom));
  }

          .lock-date-top {
            font-size: 18px;
          }

          .lock-screen-center-copy span {
            font-size: 13px;
          }

          .unlock-track {
            height: 68px;
          }

          .unlock-knob {
            width: 56px;
            height: 56px;
          }

          .unlock-text {
            font-size: 14px;
          }

          .email-card {
            padding: 18px 16px;
            border-radius: 24px;
          }

          .email-card-top h2 {
            font-size: 23px;
          }
        }
      `}</style>
    </div>
  );
}
