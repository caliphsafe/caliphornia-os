"use client";

import { useState } from "react";

export default function PlayButton({
  songId,
  songSlug,
  title,
  artist,
  sourceApp,
}: {
  songId?: string;
  songSlug?: string;
  title: string;
  artist?: string;
  sourceApp?: string;
}) {
  const [sharing, setSharing] = useState(false);
  const [message, setMessage] = useState("");

  function play() {
    window.postMessage(
      {
        type: "CALIPH_PLAY",
        track: { id: songId, songId, slug: songSlug, songSlug, title, artist, sourceApp },
      },
      "*"
    );
  }

  async function share() {
    setSharing(true);
    setMessage("");
    const result = await fetch("/api/share/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shareScope: "song", songId, songSlug }),
    }).then((res) => res.json()).catch(() => ({ ok: false, error: "Could not start Share." }));
    setSharing(false);
    setMessage(result.ok ? "Share live nearby" : result.error || "Could not start Share.");
  }

  return (
    <span className="music-action-pack">
      <button className="btn primary" onClick={play}>Play</button>
      <button className="music-share-mini-btn" onClick={share} disabled={sharing} title={`Share ${title} nearby`}>
        {sharing ? "..." : "⌁ Share"}
      </button>
      {message ? <small className="muted">{message}</small> : null}
    </span>
  );
}
