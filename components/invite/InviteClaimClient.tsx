"use client";

import { useState } from "react";

export default function InviteClaimClient({ code }: { code: string }) {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function claim(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    const res = await fetch("/api/invite/claim", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code, email, username }) });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (data?.ok) window.location.href = "/home";
    else setMessage(data.error || "Invite could not be claimed.");
  }

  return (
    <main className="shell" style={{ display: "grid", placeItems: "center" }}>
      <form onSubmit={claim} className="glass card stack" style={{ width: "min(440px, 100%)" }}>
        <span className="eyebrow">Caliphornia OS Invite</span>
        <h1 className="h2">Claim your invite.</h1>
        <p className="muted">Enter your email to create or connect your account.</p>
        <input className="input" type="email" required placeholder="Email" value={email} onChange={(event) => setEmail(event.target.value)} />
        <input className="input" placeholder="Username, optional" value={username} onChange={(event) => setUsername(event.target.value)} />
        <button className="btn primary" disabled={loading}>{loading ? "Claiming..." : "Claim Invite"}</button>
        {message ? <p className="small" style={{ color: "var(--danger)" }}>{message}</p> : null}
      </form>
    </main>
  );
}
