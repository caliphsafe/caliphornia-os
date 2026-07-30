"use client";

import { useState } from "react";

export default function InviteAcceptClient({ token }: { token: string }) {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function accept(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    const result = await fetch("/api/invite/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, email, username }),
    }).then((res) => res.json()).catch(() => ({ ok: false, error: "Could not accept invite." }));
    setLoading(false);
    if (result.ok) window.location.href = "/home";
    else setMessage(result.error || "Could not accept invite.");
  }

  return (
    <main className="shell" style={{ minHeight: "100dvh", display: "grid", placeItems: "center" }}>
      <form className="glass card stack" style={{ width: "min(440px, 100%)" }} onSubmit={accept}>
        <span className="eyebrow">Caliphornia OS Invite</span>
        <h1 className="h2">Create your account</h1>
        <p className="muted">Accept this invite to enter Caliphornia OS.</p>
        <input className="input" type="email" required placeholder="Email" value={email} onChange={(event) => setEmail(event.target.value)} />
        <input className="input" placeholder="Username, optional" value={username} onChange={(event) => setUsername(event.target.value)} />
        <button className="btn primary" disabled={loading}>{loading ? "Opening..." : "Accept Invite"}</button>
        {message ? <p className="small" style={{ color: "var(--danger)" }}>{message}</p> : null}
      </form>
    </main>
  );
}
