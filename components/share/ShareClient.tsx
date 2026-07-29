"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type LibrarySong = {
  id?: string;
  song_id?: string;
  song_slug?: string;
  title?: string;
  artist?: string;
  label?: string;
};

type Candidate = {
  id: string;
  song_title: string;
  sender_label: string;
};

type ShareStats = {
  songsPlayed?: number;
  nearbyShares?: number;
  qualifiedShares?: number;
  accountsCreated?: number;
};

function statusCopy(step: string) {
  if (step === "idle") return "Choose a song, then hold your device near the person you want to share with.";
  if (step === "searching") return "Looking for nearby listeners. Keep this screen open.";
  if (step === "sending") return "Transfer animation active. Ask the receiver to open Share and tap Receive.";
  if (step === "received") return "Share accepted. The guest one-play link is ready.";
  return "Share is ready.";
}

export default function ShareClient() {
  const [library, setLibrary] = useState<LibrarySong[]>([]);
  const [manualSlug, setManualSlug] = useState("");
  const [selectedSlug, setSelectedSlug] = useState("");
  const [shareSessionId, setShareSessionId] = useState("");
  const [phrase, setPhrase] = useState("");
  const [shareToken, setShareToken] = useState("");
  const [guestToken, setGuestToken] = useState("");
  const [guestSessionId, setGuestSessionId] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [guestUrl, setGuestUrl] = useState("");
  const [mode, setMode] = useState<"send" | "receive">("send");
  const [step, setStep] = useState("idle");
  const [error, setError] = useState("");
  const [stats, setStats] = useState<ShareStats>({});
  const pollRef = useRef<number | null>(null);

  const activeSlug = selectedSlug || manualSlug.trim();
  const selectedSong = useMemo(() => library.find((song) => song.song_slug === activeSlug), [library, activeSlug]);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [libraryRes, statsRes] = await Promise.all([
          fetch("/api/music/favorites", { cache: "no-store" }),
          fetch("/api/apps/stats?range=30d", { cache: "no-store" }).catch(() => null)
        ]);

        const libraryData = await libraryRes.json();
        if (active && Array.isArray(libraryData?.songs)) {
          setLibrary(libraryData.songs);
          const first = libraryData.songs.find((song: LibrarySong) => song.song_slug);
          if (first?.song_slug) setSelectedSlug(first.song_slug);
        }

        if (statsRes) {
          const statsData = await statsRes.json().catch(() => null);
          const my = statsData?.stats?.my || {};
          const global = statsData?.stats?.global || {};
          if (active) {
            setStats({
              songsPlayed: Number(my.songs_played || 0),
              nearbyShares: Number(global.nearby_shares || 0),
              qualifiedShares: Number(my.qualified_shares || 0),
              accountsCreated: Number(global.new_accounts_from_sharing || 0)
            });
          }
        }
      } catch {
        if (active) setLibrary([]);
      }
    }
    load();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, []);

  async function startShare() {
    setError("");
    setGuestUrl("");
    if (!activeSlug) {
      setError("Choose a song or enter a song slug first.");
      return;
    }

    setStep("searching");

    try {
      const res = await fetch("/api/nearby/share/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ songSlug: activeSlug })
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || "Could not start Share.");
      setShareSessionId(data.shareSessionId || "");
      setShareToken(data.shareToken || "");
      setPhrase(data.phrase || "");
      setStep("sending");
    } catch (err) {
      setStep("idle");
      setError(err instanceof Error ? err.message : "Could not start Share.");
    }
  }

  async function startReceive() {
    setMode("receive");
    setError("");
    setGuestUrl("");
    setStep("searching");

    try {
      const res = await fetch("/api/nearby/receive/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceLabel: "Caliphornia listener" })
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || "Could not start receiver.");
      setGuestToken(data.guestToken || "");
      setGuestSessionId(data.guestSessionId || "");
      pollCandidates(data.guestToken);
      if (pollRef.current) window.clearInterval(pollRef.current);
      pollRef.current = window.setInterval(() => pollCandidates(data.guestToken), 3500);
    } catch (err) {
      setStep("idle");
      setError(err instanceof Error ? err.message : "Could not start receiver.");
    }
  }

  async function pollCandidates(token = guestToken) {
    if (!token) return;
    try {
      const res = await fetch(`/api/nearby/receive/candidates?guestToken=${encodeURIComponent(token)}`, { cache: "no-store" });
      const data = await res.json();
      if (data?.ok && Array.isArray(data.candidates)) setCandidates(data.candidates);
    } catch {}
  }

  async function acceptCandidate(candidate: Candidate) {
    setError("");
    try {
      const res = await fetch("/api/nearby/receive/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guestToken, shareSessionId: candidate.id })
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || "Could not accept Share.");
      setGuestUrl(data.guestUrl || "");
      setStep("received");
      if (pollRef.current) window.clearInterval(pollRef.current);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not accept Share.");
    }
  }

  return (
    <main className="share-page">
      <section className="share-phone">
        <header className="share-topbar">
          <a href="/home" className="share-pill">‹ Home</a>
          <a href="/apps/stats" className="share-pill">Stats</a>
        </header>

        <section className="share-hero">
          <p>Caliphornia OS</p>
          <h1>Share</h1>
          <span>{statusCopy(step)}</span>
        </section>

        <section className={`airdrop-stage ${step}`}>
          <div className="airdrop-rings"><i /><i /><i /></div>
          <div className="airdrop-device sender"><span>♪</span><strong>You</strong></div>
          <div className="airdrop-beam"><span /></div>
          <div className="airdrop-device receiver"><span>⌁</span><strong>Nearby</strong></div>
        </section>

        <section className="share-tabs">
          <button className={mode === "send" ? "active" : ""} onClick={() => setMode("send")}>Send</button>
          <button className={mode === "receive" ? "active" : ""} onClick={startReceive}>Receive</button>
        </section>

        {mode === "send" ? (
          <section className="share-card">
            <h2>Send a song</h2>
            <p>Share works like an AirDrop-inspired music handoff. The receiver gets a guest one-play link first, then can claim the song after listening.</p>

            {library.length ? (
              <label className="share-field">
                <span>Song from Music</span>
                <select value={selectedSlug} onChange={(e) => setSelectedSlug(e.target.value)}>
                  {library.map((song) => (
                    <option key={song.id || song.song_slug} value={song.song_slug || ""}>{song.title || song.song_slug} · {song.label || "Access"}</option>
                  ))}
                </select>
              </label>
            ) : null}

            <label className="share-field">
              <span>Or song slug</span>
              <input value={manualSlug} onChange={(e) => { setManualSlug(e.target.value); setSelectedSlug(""); }} placeholder="story-time" />
            </label>

            <button className="share-main-button" onClick={startShare}>{step === "sending" ? "Share running" : "Start Share"}</button>

            {shareSessionId ? (
              <div className="share-output">
                <span>Transfer phrase</span>
                <strong>{phrase || "READY"}</strong>
                <small>Keep this screen open. The receiver should open Share and tap Receive.</small>
              </div>
            ) : null}
          </section>
        ) : (
          <section className="share-card">
            <h2>Receive nearby</h2>
            <p>When someone nearby starts a Share, it will appear below. Tap it to accept and open the guest listening link.</p>
            {!guestSessionId ? <button className="share-main-button" onClick={startReceive}>Start Receive</button> : null}
            <div className="candidate-list">
              {candidates.length ? candidates.map((candidate) => (
                <button key={candidate.id} className="candidate-card" onClick={() => acceptCandidate(candidate)}>
                  <span>From {candidate.sender_label}</span>
                  <strong>{candidate.song_title}</strong>
                  <small>Tap to accept one-play guest access</small>
                </button>
              )) : <div className="share-empty">No nearby shares yet.</div>}
            </div>
            {guestUrl ? <a href={guestUrl} className="share-main-link">Open guest player</a> : null}
          </section>
        )}

        {error ? <p className="share-error">{error}</p> : null}

        <section className="share-stats-card">
          <div><span>Your plays</span><strong>{stats.songsPlayed || 0}</strong></div>
          <div><span>Your qualified shares</span><strong>{stats.qualifiedShares || 0}</strong></div>
          <div><span>Global shares</span><strong>{stats.nearbyShares || 0}</strong></div>
          <div><span>Accounts from Share</span><strong>{stats.accountsCreated || 0}</strong></div>
          <a href="/apps/stats">Open full Stats</a>
        </section>
      </section>
    </main>
  );
}
