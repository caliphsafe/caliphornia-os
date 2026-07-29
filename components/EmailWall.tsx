"use client";
import { useState } from "react";

export default function EmailWall() {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError("");
    const res = await fetch("/api/access", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ email, username }) });
    const data = await res.json();
    setLoading(false);
    if (!data.ok) { setError(data.error || "Could not enter."); return; }
    window.location.href = "/home";
  }
  return (
    <main className="shell" style={{display:"grid",placeItems:"center"}}>
      <form onSubmit={submit} className="glass card stack" style={{width:"min(520px,100%)"}}>
        <span className="eyebrow">Caliphornia OS</span>
        <h1 className="h1">Enter the world.</h1>
        <p className="muted">Sign in with your email to keep your Music library, Kiiku, access, shares, and Stats connected.</p>
        <input className="input" type="email" required placeholder="Email" value={email} onChange={(e)=>setEmail(e.target.value)} />
        <input className="input" placeholder="Username" value={username} onChange={(e)=>setUsername(e.target.value)} />
        {error ? <p className="small" style={{color:"var(--danger)"}}>{error}</p> : null}
        <button className="btn primary" disabled={loading}>{loading ? "Entering..." : "Enter Caliphornia OS"}</button>
      </form>
    </main>
  );
}
