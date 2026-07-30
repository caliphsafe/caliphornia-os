"use client";

import { useEffect, useRef, useState } from "react";

type GuestTrack = {
  entitlementId: string;
  songId: string;
  slug: string;
  title: string;
  artist: string;
  status: string;
  used: boolean;
};

type GuestData = {
  ok?: boolean;
  error?: string;
  playbackUrl?: string;
  entitlementId?: string;
  song?: { id: string; slug: string; title: string; artist: string };
  playlist?: GuestTrack[];
};

export default function GuestPlayer({ token }: { token: string }) {
  const [data, setData] = useState<GuestData | null>(null);
  const [activeTrack, setActiveTrack] = useState<GuestTrack | null>(null);
  const [claimEmail, setClaimEmail] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [loadingTrack, setLoadingTrack] = useState(false);
  const audio = useRef<HTMLAudioElement | null>(null);

  async function loadTrack(track?: GuestTrack | null) {
    setLoadingTrack(true);
    setMessage("");

    const params = new URLSearchParams({ guestToken: token });
    if (track?.entitlementId) params.set("entitlementId", track.entitlementId);
    if (track?.songId) params.set("songId", track.songId);

    const result = await fetch(`/api/guest/audio-url?${params.toString()}`, {
      cache: "no-store",
    })
      .then((res) => res.json())
      .catch(() => ({ ok: false, error: "Could not prepare the guest player." }));

    setData(result);

    const selected =
      result?.playlist?.find((item: GuestTrack) => item.entitlementId === result.entitlementId) ||
      result?.playlist?.find((item: GuestTrack) => item.songId === result?.song?.id) ||
      null;
    setActiveTrack(selected);
    setLoadingTrack(false);
  }

  useEffect(() => {
    void loadTrack(null);
  }, [token]);

  async function completeCurrentTrack() {
    if (!activeTrack?.entitlementId && !data?.entitlementId) return;

    const result = await fetch("/api/guest/playback/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        guestToken: token,
        entitlementId: activeTrack?.entitlementId || data?.entitlementId,
        songId: activeTrack?.songId || data?.song?.id,
      }),
    })
      .then((res) => res.json())
      .catch(() => ({ ok: false }));

    if (result?.ok) {
      setMessage(
        result.remaining > 0
          ? `${result.remaining} shared play${result.remaining === 1 ? "" : "s"} left in this project.`
          : "You completed the shared listen. Claim it to keep it in your Caliphornia Music library."
      );
      await loadTrack(null);
    }
  }

  async function startClaim() {
    const result = await fetch("/api/guest/claim/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guestToken: token, email: claimEmail }),
    }).then((res) => res.json());

    setMessage(result.devCode ? `Code sent. Dev code: ${result.devCode}` : result.ok ? "Code sent." : result.error);
  }

  async function verify() {
    const result = await fetch("/api/guest/claim/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guestToken: token, email: claimEmail, code }),
    }).then((res) => res.json());

    if (result.ok) window.location.href = "/apps/music";
    else setMessage(result.error || "Could not verify this code.");
  }

  const playlist = data?.playlist || [];
  const hasProjectShare = playlist.length > 1;

  return (
    <main className="guest-share-page">
      <section className="guest-share-phone">
        <header className="guest-share-topbar">
          <a href="/" className="guest-share-pill">Caliphornia OS</a>
          <a href="/apps/share" className="guest-share-pill">Open Share</a>
        </header>

        <section className="guest-share-hero">
          <p>{hasProjectShare ? "Project Share" : "Song Share"}</p>
          <h1>{data?.song?.title || "Shared listening"}</h1>
          <span>
            {hasProjectShare
              ? "You received one full guest listen for each song in this project."
              : "You received one full guest listen before creating an account."}
          </span>
        </section>

        {playlist.length ? (
          <section className="guest-share-playlist">
            {playlist.map((track) => (
              <button
                key={track.entitlementId}
                type="button"
                className={activeTrack?.entitlementId === track.entitlementId ? "active" : ""}
                disabled={track.used || loadingTrack}
                onClick={() => loadTrack(track)}
              >
                <span>{track.used ? "Played" : "Available"}</span>
                <strong>{track.title}</strong>
                <small>{track.artist}</small>
              </button>
            ))}
          </section>
        ) : null}

        <section className="guest-player-card">
          {data?.playbackUrl ? (
            <audio
              ref={audio}
              src={data.playbackUrl}
              controls
              autoPlay
              controlsList="nodownload noplaybackrate"
              onEnded={() => void completeCurrentTrack()}
            />
          ) : (
            <p>{data?.error || "Preparing your shared play..."}</p>
          )}
        </section>

        <section className="guest-claim-card">
          <p>Claim after listening</p>
          <h2>Keep this in your Music library.</h2>
          <span>
            Enter your email after listening. Caliphornia OS will connect this shared play to your account without making you restart the experience.
          </span>
          <input type="email" placeholder="Email" value={claimEmail} onChange={(event) => setClaimEmail(event.target.value)} />
          <button type="button" onClick={startClaim}>Send code</button>
          <input placeholder="One-time code" value={code} onChange={(event) => setCode(event.target.value)} />
          <button type="button" className="primary" onClick={verify}>Verify and open Music</button>
          {message ? <div className="guest-message">{message}</div> : null}
        </section>
      </section>
    </main>
  );
}
