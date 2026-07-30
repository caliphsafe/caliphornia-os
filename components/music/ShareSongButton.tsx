"use client";

import { useState } from "react";

export default function ShareSongButton({ songId, songSlug, title }: { songId?: string | null; songSlug?: string | null; title: string }) {
  const [state, setState] = useState<"idle" | "starting" | "live" | "error">("idle");
  const [message, setMessage] = useState("");

  async function startShare() {
    if (!songId && !songSlug) return;
    setState("starting");
    setMessage("");
    try {
      const res = await fetch("/api/share/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shareScope: "song", songId, songSlug }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) throw new Error(data.error || "Could not start Share.");
      setState("live");
      setMessage(`${title} is live nearby. The receiver opens Caliphornia OS and taps Receive.`);
      window.dispatchEvent(new CustomEvent("caliph-share-started", { detail: data }));
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Could not start Share.");
    }
  }

  return (
    <span className="music-share-wrap">
      <button type="button" className="music-share-button" onClick={startShare} disabled={state === "starting"}>
        {state === "starting" ? "Starting..." : state === "live" ? "Share Live" : "Share"}
      </button>
      {message ? <span className={`music-share-message ${state}`}>{message}</span> : null}
    </span>
  );
}
