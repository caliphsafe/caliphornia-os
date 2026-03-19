"use client";

import { FormEvent, useState } from "react";

export default function EmailWall() {
  const [email, setEmail] = useState("");
  const [step, setStep] = useState<"locked" | "form">("locked");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
    <div className="lock-screen-panel">
      {step === "locked" ? (
        <>
          <div className="lock-top">
            <div className="lock-time">9:41</div>
            <div className="lock-date">Caliphornia OS</div>
          </div>

          <div className="swipe-wrap">
            <button
              className="swipe-button"
              onClick={() => setStep("form")}
              aria-label="Swipe to unlock"
            >
              <span className="swipe-pill" />
              <span className="swipe-text">Swipe to unlock</span>
            </button>
          </div>
        </>
      ) : (
        <form className="email-card" onSubmit={handleSubmit}>
          <h2>Enter your email</h2>
          <p>
            Unlock the home screen and access music, apps, games, and future drops.
          </p>

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
            {loading ? "Unlocking..." : "Unlock Home Screen"}
          </button>

          <button
            type="button"
            className="ghost-btn"
            onClick={() => setStep("locked")}
          >
            Back
          </button>
        </form>
      )}
    </div>
  );
}
