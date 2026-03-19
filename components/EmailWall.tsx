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

export default function EmailWall() {
  const [email, setEmail] = useState("");
  const [step, setStep] = useState<ScreenStep>("locked");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [now, setNow] = useState(new Date());

  const trackRef = useRef<HTMLDivElement | null>(null);
  const knobRef = useRef<HTMLButtonElement | null>(null);
  const draggingRef = useRef(false);
  const startXRef = useRef(0);
  const startLeftRef = useRef(0);

  const [knobLeft, setKnobLeft] = useState(6);
  const [trackWidth, setTrackWidth] = useState(0);
  const knobSize = 56;

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
    return Math.max(6, trackWidth - knobSize - 6);
  }, [trackWidth]);

  useEffect(() => {
    if (step === "locked") {
      setKnobLeft(6);
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
    const next = Math.min(maxLeft, Math.max(6, startLeftRef.current + delta));
    setKnobLeft(next);
  }

  function endDrag() {
    if (!draggingRef.current) return;
    draggingRef.current = false;

    const unlockThreshold = maxLeft * 0.72;
    if (knobLeft >= unlockThreshold) {
      setKnobLeft(maxLeft);
      setTimeout(() => {
        setStep("form");
        setKnobLeft(6);
      }, 120);
    } else {
      setKnobLeft(6);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/access", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ email })
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
    <div className="lock-screen-panel ios-lock-shell">
      <div className="lock-wallpaper-glow" />

      {step === "locked" ? (
        <>
          <div className="lock-screen-content">
            <div className="lock-date-top">{getFormattedDate(now)}</div>
            <div className="lock-time-live">{getFormattedTime(now)}</div>

            <div className="lock-screen-center-copy">
              <p>Caliphornia OS</p>
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
              <button
                ref={knobRef}
                type="button"
                className="unlock-knob"
                style={{ left: `${knobLeft}px` }}
                onPointerDown={(e) => beginDrag(e.clientX)}
                aria-label="Swipe to unlock"
              >
                <span className="unlock-knob-arrow">→</span>
              </button>

              <div
                className="unlock-fill"
                style={{ width: `${Math.min(knobLeft + knobSize, trackWidth - 6)}px` }}
              />

              <div
                className="unlock-text"
                style={{
                  opacity: Math.max(0, 1 - knobLeft / (maxLeft || 1))
                }}
              >
                Swipe up your world
              </div>
            </div>
          </div>
        </>
      ) : (
        <form className="email-card ios-email-card" onSubmit={handleSubmit}>
          <div className="email-card-top">
            <div className="mini-pill" />
            <h2>Enter your email</h2>
            <p>
              Unlock your music apps, playlists, lyrics, releases, and future drops.
            </p>
          </div>

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

          {error ? <p className="form-error">{error}</p> : null}

          <button className="primary-btn" type="submit" disabled={loading}>
            {loading ? "Unlocking..." : "Enter Home Screen"}
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
    </div>
  );
}