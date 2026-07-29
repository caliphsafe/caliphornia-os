"use client";

import { useEffect, useState } from "react";
import FriendsThreadClient from "@/components/FriendsThreadClient";

type ApiState = {
  loading: boolean;
  error: string;
  locked: boolean;
  conversation: any | null;
  messages: any[];
  finalTrack: any | null;
};

export default function FriendsThreadLoader({ slug }: { slug: string }) {
  const [state, setState] = useState<ApiState>({
    loading: true,
    error: "",
    locked: false,
    conversation: null,
    messages: [],
    finalTrack: null,
  });

  useEffect(() => {
    let alive = true;

    async function load() {
      setState((prev) => ({ ...prev, loading: true, error: "" }));

      try {
        const res = await fetch(`/api/apps/friends/conversations/${slug}`, {
          cache: "no-store",
        });
        const data = await res.json();

        if (!alive) return;

        if (!res.ok || !data.ok) {
          setState({
            loading: false,
            error: data?.error || "Could not load this conversation.",
            locked: false,
            conversation: null,
            messages: [],
            finalTrack: null,
          });
          return;
        }

        setState({
          loading: false,
          error: "",
          locked: Boolean(data.locked),
          conversation: data.conversation || null,
          messages: Array.isArray(data.messages) ? data.messages : [],
          finalTrack: data.final_track || data.conversation?.final_track || null,
        });
      } catch {
        if (!alive) return;
        setState({
          loading: false,
          error: "Could not load this conversation.",
          locked: false,
          conversation: null,
          messages: [],
          finalTrack: null,
        });
      }
    }

    void load();
    return () => {
      alive = false;
    };
  }, [slug]);

  function playLockedPreview() {
    if (!state.finalTrack?.file) return;

    window.postMessage(
      {
        type: "CALIPH_PLAYER_TOGGLE_TRACK",
        startIndex: 0,
        tracks: [
          {
            slug: state.finalTrack.playlist_song_slug || state.finalTrack.slug,
            title: state.finalTrack.title || "fri.ends preview",
            artist: state.finalTrack.artist || "Caliph",
            displayTitle: state.finalTrack.title || "fri.ends preview",
            file: state.finalTrack.file,
            playlistSongSlug: state.finalTrack.playlist_song_slug || state.finalTrack.slug,
            analyticsSongSlug: state.finalTrack.analytics_song_slug || state.finalTrack.slug,
            sourceApp: "friends",
            conversationSlug: slug,
            conversationRoute: `/apps/friends/${slug}`,
            isPreview: true,
            clipStartSeconds: state.finalTrack.clip_start_seconds ?? null,
            clipEndSeconds: state.finalTrack.clip_end_seconds ?? null,
          },
        ],
      },
      "*"
    );
  }

  if (state.loading || state.error || state.locked || !state.conversation) {
    return (
      <div className="app-shell friends-original-app-shell">
        <section className="screen screen-thread is-active" aria-label="Conversation status">
          <div className="friends-original-thread-topbar top-safe">
            <a href="/apps/friends" className="friends-original-back-btn" aria-label="Back to inbox">
              <span className="friends-original-back-chevron" aria-hidden="true"></span>
              <span className="friends-original-back-text">Fri.ends</span>
            </a>
          </div>

          <main className="friends-original-messages-wrap">
            <div className="friends-original-messages">
              <div className="friends-original-timestamp">
                {state.loading
                  ? "Loading conversation..."
                  : state.error || "Unlock Fri.ends to view the full conversation."}
              </div>

              {state.locked ? (
                <div className="friends-original-message-row incoming">
                  <div className="friends-original-message-group">
                    <div className="friends-original-message-bubble">
                      This conversation is locked. You can play the preview or unlock Fri.ends from the access window.
                    </div>
                    {state.finalTrack?.file ? (
                      <button
                        type="button"
                        className="friends-original-audio-card"
                        onClick={playLockedPreview}
                      >
                        <div className="friends-original-audio-card-top">
                          <span className="friends-original-audio-play"></span>
                          <div className="friends-original-wave-wrap">
                            <div className="friends-original-waveform">
                              {Array.from({ length: 28 }).map((_, i) => (
                                <span key={i} style={{ height: `${8 + (i % 6) * 4}px` }} />
                              ))}
                            </div>
                            <div className="friends-original-audio-duration">0:30</div>
                          </div>
                        </div>
                        <div className="friends-original-audio-meta">
                          <div className="friends-original-audio-file-name">Preview</div>
                          <div className="friends-original-audio-kind">Voice note</div>
                        </div>
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          </main>
        </section>
      </div>
    );
  }

  return <FriendsThreadClient conversation={state.conversation} messages={state.messages} />;
}
