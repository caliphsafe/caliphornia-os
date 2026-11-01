"use client";

import { useEffect, useState } from "react";
import FriendsThreadClient from "@/components/FriendsThreadClient";
import AppBackLink from "@/components/AppBackLink";
import type { GlobalTrack } from "@/components/GlobalPlayer";

type ThreadData = {
  locked?: boolean;
  conversation?: any;
  messages?: any[];
  final_track?: any;
};

export default function FriendsThreadLoader({ slug }: { slug: string }) {
  const [data, setData] = useState<ThreadData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await fetch(`/api/apps/friends/conversations/${encodeURIComponent(slug)}`, { cache: "no-store" });
        const json = await res.json();
        if (!active) return;
        if (!json?.ok) {
          setError(json?.error || "Could not open this conversation.");
          return;
        }
        setData(json);
      } catch {
        if (active) setError("Could not open this conversation.");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [slug]);

  function playPreview() {
    const finalTrack = data?.final_track || data?.conversation?.final_track;
    if (!finalTrack?.file) return;
    const track: GlobalTrack = {
      slug: finalTrack.slug || slug,
      title: finalTrack.title || slug,
      artist: finalTrack.artist || "Caliph",
      displayTitle: finalTrack.title || slug,
      file: finalTrack.file,
      playlistSongSlug: finalTrack.playlist_song_slug || finalTrack.slug || slug,
      analyticsSongSlug: finalTrack.analytics_song_slug || finalTrack.slug || slug,
      sourceApp: "friends",
      conversationSlug: slug,
      conversationRoute: `/apps/friends/${slug}`,
      isPreview: Boolean(finalTrack.is_preview),
      clipStartSeconds: finalTrack.clip_start_seconds ?? null,
      clipEndSeconds: finalTrack.clip_end_seconds ?? null,
    };
    window.postMessage({ type: "CALIPH_PLAYER_TOGGLE_TRACK", tracks: [track], startIndex: 0 }, "*");
  }

  if (loading) {
    return <main className="app-shell friends-original-app-shell"><section className="screen screen-thread is-active"><div className="friends-original-empty-state">Loading conversation...</div></section></main>;
  }

  if (error) {
    return (
      <main className="app-shell friends-original-app-shell">
        <section className="screen screen-thread is-active">
          <div className="friends-original-thread-topbar top-safe">
            <AppBackLink
              href="/apps/friends"
              label="Fri.ends"
              className="friends-original-back-btn"
            />
          </div>
          <div className="friends-original-empty-state">{error}</div>
        </section>
      </main>
    );
  }

  if (data?.locked) {
    const finalTrack = data.final_track;
    return (
      <main className="app-shell friends-original-app-shell">
        <section className="screen screen-thread is-active">
          <div className="friends-original-thread-topbar top-safe">
            <AppBackLink
              href="/apps/friends"
              label="Fri.ends"
              className="friends-original-back-btn"
            />
          </div>
          <div className="friends-original-locked-card">
            <h1>{finalTrack?.title || slug}</h1>
            <p>This conversation is locked. Play the preview or unlock Fri.ends from Account.</p>
            {finalTrack?.file ? <button onClick={playPreview}>Play Preview</button> : null}
            <a href="/apps/account">Open Account</a>
          </div>
        </section>
      </main>
    );
  }

  if (!data?.conversation) {
    return (
      <main className="app-shell friends-original-app-shell">
        <section className="screen screen-thread is-active">
          <div className="friends-original-thread-topbar top-safe">
            <AppBackLink
              href="/apps/friends"
              label="Fri.ends"
              className="friends-original-back-btn"
            />
          </div>
          <div className="friends-original-empty-state">Conversation not found.</div>
        </section>
      </main>
    );
  }

  return <FriendsThreadClient conversation={data.conversation} messages={data.messages || []} />;
}
