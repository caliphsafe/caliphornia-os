"use client";

import { useEffect, useState } from "react";
import FriendsThreadClient from "@/components/FriendsThreadClient";

export default function FriendsThreadLoader({ slug }: { slug: string }) {
  const [state, setState] = useState<"loading" | "ready" | "locked" | "error">("loading");
  const [conversation, setConversation] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [finalTrack, setFinalTrack] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const res = await fetch(`/api/apps/friends/conversations/${encodeURIComponent(slug)}`, { cache: "no-store" });
        const data = await res.json().catch(() => null);
        if (!mounted) return;
        if (!res.ok || !data?.ok) {
          setError(data?.error || "Conversation could not load.");
          setState("error");
          return;
        }
        if (data.locked) {
          setFinalTrack(data.final_track || null);
          setState("locked");
          return;
        }
        setConversation(data.conversation || null);
        setMessages(Array.isArray(data.messages) ? data.messages : []);
        setState("ready");
      } catch {
        if (!mounted) return;
        setError("Conversation could not load.");
        setState("error");
      }
    }
    void load();
    return () => { mounted = false; };
  }, [slug]);

  if (state === "ready" && conversation) return <FriendsThreadClient conversation={conversation} messages={messages} />;

  function playPreview() {
    if (!finalTrack?.file) return;
    window.postMessage({ type: "CALIPH_PLAYER_TOGGLE_TRACK", tracks: [{ slug: finalTrack.playlist_song_slug || finalTrack.slug || slug, title: finalTrack.title || slug, artist: finalTrack.artist || "Caliph", file: finalTrack.file, playlistSongSlug: finalTrack.playlist_song_slug || finalTrack.slug || slug, analyticsSongSlug: finalTrack.analytics_song_slug || finalTrack.slug || slug, sourceApp: "friends", conversationSlug: slug, conversationRoute: `/apps/friends/${slug}`, isPreview: true, clipStartSeconds: finalTrack.clip_start_seconds ?? null, clipEndSeconds: finalTrack.clip_end_seconds ?? null }], startIndex: 0 }, "*");
  }

  return (
    <div className="app-shell friends-original-app-shell">
      <section className="screen screen-thread is-active" aria-label="Conversation status">
        <div className="friends-original-thread-topbar top-safe">
          <a href="/apps/friends" className="friends-original-back-btn">‹ Fri.ends</a>
          <button className="friends-original-thread-header-card" type="button">
            <div className="friends-original-thread-header-meta">
              <div className="friends-original-thread-avatar friends-original-thread-avatar--header">F</div>
              <div className="friends-original-thread-header-text">
                <div className="friends-original-thread-header-title">{state === "loading" ? "Loading..." : state === "locked" ? "Locked conversation" : "Could not load"}</div>
                <div className="friends-original-thread-header-subtitle">{state === "locked" ? "Play the preview or unlock Fri.ends." : error || "Reconnecting thread."}</div>
              </div>
            </div>
          </button>
        </div>
        <main className="friends-original-messages-wrap">
          <div className="friends-original-messages">
            <div className="friends-original-timestamp">{state === "locked" ? "Preview available" : state === "loading" ? "Loading messages" : "Error"}</div>
            <div className="friends-original-message-row incoming"><div className="friends-original-message-group"><div className="friends-original-message-bubble">{state === "locked" ? "This thread is part of Fri.ends. Unlock the project to open the full conversation." : error || "Hold on while the thread reconnects."}</div></div></div>
            {state === "locked" && finalTrack?.file ? <div className="friends-original-message-row incoming"><div className="friends-original-message-group"><button className="friends-original-audio-card" type="button" onClick={playPreview}><div className="friends-original-audio-card-top"><span className="friends-original-audio-play"></span><div className="friends-original-wave-wrap"><div className="friends-original-waveform">{Array.from({ length: 28 }).map((_, i) => <span key={i} style={{ height: `${8 + (i % 6) * 4}px` }} />)}</div><div className="friends-original-audio-duration">0:30</div></div></div><div className="friends-original-audio-meta"><div className="friends-original-audio-file-name">{finalTrack.title || "Preview"}</div><div className="friends-original-audio-kind">Preview voice note</div></div></button></div></div> : null}
          </div>
        </main>
      </section>
    </div>
  );
}
