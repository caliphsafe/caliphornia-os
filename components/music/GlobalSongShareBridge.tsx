"use client";

import { useEffect, useMemo, useState } from "react";

type PlayerState = {
  slug?: string | null;
  playlistSongSlug?: string | null;
  analyticsSongSlug?: string | null;
  title?: string | null;
  isPlaying?: boolean;
};

export default function GlobalSongShareBridge() {
  const [state, setState] = useState<PlayerState | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      const data = event.data;
      if (!data || typeof data !== "object") return;
      if (data.type === "CALIPH_PLAYER_STATE") {
        setState({
          slug: data.slug || null,
          playlistSongSlug: data.playlistSongSlug || null,
          analyticsSongSlug: data.analyticsSongSlug || null,
          title: data.title || null,
          isPlaying: Boolean(data.isPlaying),
        });
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const songSlug = useMemo(() => state?.playlistSongSlug || state?.analyticsSongSlug || state?.slug || "", [state]);
  if (!songSlug) return null;

  async function startShare() {
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/share/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shareScope: "song", songSlug }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) throw new Error(data.error || "Could not start Share.");
      setMessage("Share is live nearby.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not start Share.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="global-song-share-bridge">
      <button type="button" onClick={startShare} disabled={loading}>
        {loading ? "Starting..." : "Share playing"}
      </button>
      {message ? <span>{message}</span> : null}
    </div>
  );
}
