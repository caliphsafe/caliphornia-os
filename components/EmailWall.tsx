"use client";

import { useEffect, useMemo, useState } from "react";

function formatTime(date: Date) {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDate(date: Date) {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export default function EmailWall() {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000 * 30);
    return () => clearInterval(timer);
  }, []);

  const greeting = useMemo(() => {
    const hour = now.getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  }, [now]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/access", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, username }),
      });

      const data = await res.json();

      if (!data.ok) {
        setError(data.error || "Could not enter.");
        setLoading(false);
        return;
      }

      window.location.href = "/home";
    } catch {
      setError("Could not enter. Please try again.");
      setLoading(false);
    }
  }

  return (
    <main
      className="shell"
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        overflow: "hidden",
        position: "relative",
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          background:
            "radial-gradient(circle at 50% 8%, rgba(157,220,255,.30), transparent 30%), radial-gradient(circle at 20% 85%, rgba(248,212,119,.22), transparent 26%), linear-gradient(180deg, #111827 0%, #05060a 58%, #02030a 100%)",
          zIndex: -3,
        }}
      />

      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          background:
            "linear-gradient(120deg, transparent, rgba(255,255,255,.06), transparent)",
          opacity: 0.45,
          zIndex: -2,
        }}
      />

      <section
        style={{
          width: "min(430px, 100%)",
          minHeight: "min(820px, calc(100dvh - 28px))",
          borderRadius: 44,
          border: "1px solid rgba(255,255,255,.18)",
          background:
            "linear-gradient(180deg, rgba(255,255,255,.13), rgba(255,255,255,.05))",
          boxShadow: "0 40px 120px rgba(0,0,0,.48)",
          backdropFilter: "blur(28px)",
          padding: 22,
          display: "grid",
          alignContent: "space-between",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 10,
            left: "50%",
            transform: "translateX(-50%)",
            width: 118,
            height: 28,
            borderRadius: 999,
            background: "rgba(0,0,0,.55)",
            border: "1px solid rgba(255,255,255,.08)",
          }}
        />

        <div style={{ textAlign: "center", paddingTop: 64 }}>
          <div
            style={{
              fontSize: "4.8rem",
              lineHeight: 1,
              letterSpacing: "-.08em",
              fontWeight: 700,
            }}
          >
            {formatTime(now)}
          </div>

          <div
            style={{
              marginTop: 8,
              color: "rgba(248,250,252,.82)",
              fontWeight: 600,
            }}
          >
            {formatDate(now)}
          </div>
        </div>

        <div style={{ display: "grid", gap: 18 }}>
          {!isOpen ? (
            <>
              <div className="glass card stack">
                <span className="eyebrow">Caliphornia OS</span>
                <h1 className="h2">{greeting}</h1>
                <p className="muted" style={{ margin: 0 }}>
                  Music, worlds, stories, and apps connected in one place.
                </p>
              </div>

              <button
                type="button"
                className="btn primary"
                onClick={() => setIsOpen(true)}
                style={{ width: "100%" }}
              >
                Swipe to enter
              </button>
            </>
          ) : (
            <form onSubmit={submit} className="glass card stack">
              <div className="stack" style={{ gap: 8 }}>
                <span className="eyebrow">Caliphornia OS</span>
                <h1 className="h2">Enter the world.</h1>
                <p className="muted" style={{ margin: 0 }}>
                  Sign in with your email to keep your Music library, Kiiku,
                  access, shares, and Stats connected.
                </p>
              </div>

              <input
                className="input"
                type="email"
                required
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />

              <input
                className="input"
                placeholder="Username, optional"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />

              {error ? (
                <p className="small" style={{ color: "var(--danger)", margin: 0 }}>
                  {error}
                </p>
              ) : null}

              <button className="btn primary" disabled={loading}>
                {loading ? "Entering..." : "Enter Caliphornia OS"}
              </button>

              <button
                type="button"
                className="btn"
                onClick={() => setIsOpen(false)}
              >
                Back to lock screen
              </button>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}
