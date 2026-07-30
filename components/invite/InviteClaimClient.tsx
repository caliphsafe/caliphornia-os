"use client";

import { useState } from "react";

export default function InviteClaimClient({ code }: { code: string }) {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function claim(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/invite/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, email, username }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data?.ok) {
        setMessage(data?.error || "Invite could not be claimed.");
        return;
      }

      window.location.assign("/home");
    } catch {
      setMessage("Invite could not be claimed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      className="shell"
      style={{ minHeight: "100dvh", display: "grid", placeItems: "center" }}
    >
      <form
        onSubmit={claim}
        className="glass card stack"
        style={{ width: "min(440px, 100%)" }}
      >
        <span className="eyebrow">Caliphornia OS Invite</span>
        <h1 className="h2">Claim your invite.</h1>
        <p className="muted">
          Enter your email to create or connect your Caliphornia OS account.
        </p>

        <input
          className="input"
          type="email"
          autoComplete="email"
          required
          placeholder="Email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />

        <input
          className="input"
          autoComplete="username"
          placeholder="Username, optional"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
        />

        <button className="btn primary" type="submit" disabled={loading}>
          {loading ? "Opening..." : "Claim Invite"}
        </button>

        {message ? (
          <p className="small" role="alert" style={{ color: "var(--danger)" }}>
            {message}
          </p>
        ) : null}
      </form>
    </main>
  );
}
