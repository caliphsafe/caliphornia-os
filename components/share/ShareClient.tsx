"use client";

import { useEffect, useMemo, useState } from "react";

type Mode = "send" | "receive";

type Candidate = {
  id?: string;
  shareSessionId?: string;
  senderLabel?: string;
  songTitle?: string;
  projectTitle?: string;
  phraseHint?: string;
  distanceLabel?: string;
  expiresAt?: string;
};

export default function ShareClient() {
  const [mode, setMode] = useState<Mode>("send");
  const [songSlug, setSongSlug] = useState("");
  const [phrase, setPhrase] = useState("");
  const [shareId, setShareId] = useState("");
  const [guestSessionId, setGuestSessionId] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const statusText = useMemo(() => {
    if (error) return error;
    if (status) return status;
    return mode === "send"
      ? "Choose a song and start a short nearby Share session."
      : "Start receiving, then pick the Share that appears nearby.";
  }, [error, mode, status]);

  async function startSending() {
    setLoading(true);
    setError("");
    setStatus("Creating Share session...");

    try {
      const res = await fetch("/api/nearby/share/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ songSlug: songSlug.trim() || undefined }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        setError(data?.error || "Could not start Share.");
        setStatus("");
        return;
      }

      setShareId(data.shareSessionId || data.sessionId || data.id || "");
      setPhrase(data.fallbackPhrase || data.phrase || data.sharePhrase || "");
      setStatus("Share is live. Keep this screen open while the listener receives it.");
    } catch {
      setError("Could not start Share.");
      setStatus("");
    } finally {
      setLoading(false);
    }
  }

  async function startReceiving() {
    setLoading(true);
    setError("");
    setStatus("Starting receiver...");

    try {
      const res = await fetch("/api/nearby/receive/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        setError(data?.error || "Could not start receiving.");
        setStatus("");
        return;
      }

      setGuestSessionId(data.guestSessionId || data.receiverSessionId || data.sessionId || "");
      setStatus("Receiver is ready. Searching for nearby Shares...");
      await loadCandidates(data.guestSessionId || data.receiverSessionId || data.sessionId || "");
    } catch {
      setError("Could not start receiving.");
      setStatus("");
    } finally {
      setLoading(false);
    }
  }

  async function loadCandidates(sessionId = guestSessionId) {
    if (!sessionId) return;
    try {
      const url = new URL("/api/nearby/receive/candidates", window.location.origin);
      url.searchParams.set("guestSessionId", sessionId);
      const res = await fetch(url.toString(), { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok) {
        setCandidates(Array.isArray(data.candidates) ? data.candidates : []);
        setStatus(data.candidates?.length ? "Choose the Share you recognize." : "No Shares found yet. Keep both phones open.");
      }
    } catch {}
  }

  async function confirmCandidate(candidate: Candidate) {
    const shareSessionId = candidate.shareSessionId || candidate.id;
    if (!shareSessionId || !guestSessionId) return;

    setLoading(true);
    setError("");
    setStatus("Confirming Share...");

    try {
      const res = await fetch("/api/nearby/receive/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guestSessionId, shareSessionId }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        setError(data?.error || "Could not confirm Share.");
        setStatus("");
        return;
      }

      if (data.guestUrl) {
        window.location.href = data.guestUrl;
        return;
      }

      if (data.token) {
        window.location.href = `/guest/${data.token}`;
        return;
      }

      setStatus("Share confirmed. Open your guest player to listen once.");
    } catch {
      setError("Could not confirm Share.");
      setStatus("");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (mode !== "receive" || !guestSessionId) return;
    const timer = window.setInterval(() => void loadCandidates(), 4000);
    return () => window.clearInterval(timer);
  }, [guestSessionId, mode]);

  return (
    <main className="share-root">
      <div className="share-bg" aria-hidden="true" />

      <section className="share-phone">
        <div className="share-island" aria-hidden="true" />

        <header className="share-topbar">
          <a href="/home" aria-label="Back home">‹</a>
          <div>
            <span>Caliphornia OS</span>
            <h1>Share</h1>
          </div>
          <button type="button" onClick={() => setMode(mode === "send" ? "receive" : "send")}>{mode === "send" ? "Receive" : "Send"}</button>
        </header>

        <section className="share-hero-card">
          <div className="share-glyph">⌁</div>
          <p>Seamless song sharing without QR codes.</p>
          <strong>{mode === "send" ? "Send one protected play" : "Receive one protected play"}</strong>
        </section>

        <div className="share-segment">
          <button className={mode === "send" ? "active" : ""} onClick={() => setMode("send")} type="button">Send</button>
          <button className={mode === "receive" ? "active" : ""} onClick={() => setMode("receive")} type="button">Receive</button>
        </div>

        {mode === "send" ? (
          <section className="share-panel">
            <label>
              <span>Song slug, optional</span>
              <input value={songSlug} onChange={(e) => setSongSlug(e.target.value)} placeholder="story-time" />
            </label>
            <button className="share-primary" disabled={loading} onClick={startSending} type="button">
              {loading ? "Starting..." : "Start Share"}
            </button>
            {shareId ? (
              <div className="share-live-card">
                <span>Share is live</span>
                <strong>{phrase || "Keep both phones open"}</strong>
                <p>Use this phrase only as a fallback if the receiver sees more than one Share nearby.</p>
              </div>
            ) : null}
          </section>
        ) : (
          <section className="share-panel">
            <button className="share-primary" disabled={loading} onClick={startReceiving} type="button">
              {loading ? "Starting..." : "Start Receiving"}
            </button>
            <button className="share-secondary" disabled={!guestSessionId} onClick={() => void loadCandidates()} type="button">
              Refresh nearby Shares
            </button>
            <div className="share-candidates">
              {candidates.map((candidate, index) => (
                <button key={candidate.shareSessionId || candidate.id || index} type="button" onClick={() => void confirmCandidate(candidate)}>
                  <span>{candidate.senderLabel || "Nearby listener"}</span>
                  <strong>{candidate.songTitle || candidate.projectTitle || "Shared song"}</strong>
                  <small>{candidate.distanceLabel || candidate.phraseHint || "Tap to accept one play"}</small>
                </button>
              ))}
            </div>
          </section>
        )}

        <footer className={`share-status ${error ? "error" : ""}`}>{statusText}</footer>
      </section>
    </main>
  );
}
