"use client";

import { useState } from "react";
import ShareSongButton from "@/components/music/ShareSongButton";

export default function PlayButton({
  songId,
  songSlug,
  title,
  artist,
  showShare = true,
}: {
  songId?: string | null;
  songSlug?: string | null;
  title: string;
  artist?: string | null;
  showShare?: boolean;
}) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function play() {
    window.postMessage({ type: "CALIPH_PLAY", track: { songId, songSlug, title, artist } }, "*");
  }

  async function favorite() {
    setSaving(true);
    try {
      const res = await fetch("/api/playlists/toggle-favorite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ songId, songSlug }),
      });
      const data = await res.json();
      if (data?.ok) setSaved(Boolean(data.saved));
    } finally {
      setSaving(false);
    }
  }

  return (
    <span className="music-actions-row">
      <button className="btn primary" onClick={play}>Play</button>
      <button className={`btn ${saved ? "is-saved" : ""}`} onClick={favorite} disabled={saving}>{saved ? "Saved" : "Favorite"}</button>
      {showShare ? <ShareSongButton songId={songId} songSlug={songSlug} title={title} /> : null}
    </span>
  );
}
