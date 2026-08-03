"use client";

import { useEffect, useMemo, useState } from "react";
import ProximityReceivePrompt from "@/components/share/ProximityReceivePrompt";

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
    const timer = window.setInterval(
      () => setNow(new Date()),
      1000 * 30,
    );

    return () => window.clearInterval(timer);
  }, []);

  const greeting = useMemo(() => {
    const hour = now.getHours();

    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  }, [now]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/access", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, username }),
      });

      const data = await response.json();

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
    <main className="lock-screen-page">
      <div className="lock-screen-background" aria-hidden="true" />

      <section className="lock-screen-phone">
        <div className="lock-screen-island" aria-hidden="true" />

        <header className="lock-screen-clock">
          <div className="lock-screen-time">{formatTime(now)}</div>
          <div className="lock-screen-date">{formatDate(now)}</div>
        </header>

        {!isOpen ? (
          <div
            className="lock-screen-notification-area"
            aria-label="Nearby Share notifications"
          >
            <ProximityReceivePrompt />
          </div>
        ) : (
          <div aria-hidden="true" />
        )}

        <div className="lock-screen-bottom">
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
                  Sign in with your email to keep your Music library,
                  Kiiku, access, shares, and Stats connected.
                </p>
              </div>

              <input
                className="input"
                type="email"
                required
                placeholder="Email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />

              <input
                className="input"
                placeholder="Username, optional"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
              />

              {error ? (
                <p
                  className="small"
                  style={{ color: "var(--danger)", margin: 0 }}
                >
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
