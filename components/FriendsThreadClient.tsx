"use client";

import { useEffect, useState } from "react";

type Clip = {
  id: string;
  clip_title: string;
  start_seconds: number;
  end_seconds: number | null;
  display_duration?: string | null;
  file: string | null;
  signing_error?: string | null;
  playlist_song_slug?: string | null;
  playlist_song_title?: string | null;
  playlist_song_artist?: string | null;
  asset?: {
    id: string;
    slug: string;
    title: string;
    storage_path?: string | null;
    version_label?: string | null;
    is_final_version?: boolean;
    is_playlistable?: boolean;
    linked_song_id?: string | null;
  } | null;
};

type Message = {
  id: string;
  message_type: string;
  sender_name?: string | null;
  sender_label?: string | null;
  body?: string | null;
  position: number;
  message_side?: string | null;
  display_time?: string | null;
  audio_label?: string | null;
  audio_kind?: string | null;
  clip?: Clip | null;
};

type Conversation = {
  id: string;
  slug: string;
  title: string;
  subtitle?: string | null;
  avatar_letter?: string | null;
};

export default function FriendsThreadClient({
  conversation,
  messages
}: {
  conversation: Conversation;
  messages: Message[];
}) {
  const [activeClipId, setActiveClipId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [clipProgress, setClipProgress] = useState<Record<string, number>>({});
  const [clipTimes, setClipTimes] = useState<Record<string, number>>({});

  function formatTime(seconds: number) {
    const s = Math.max(0, Math.floor(seconds));
    const mm = Math.floor(s / 60);
    const ss = s % 60;
    return `${mm}:${String(ss).padStart(2, "0")}`;
  }

  useEffect(() => {
    function onPlayerState(event: MessageEvent) {
      const data = event.data;
      if (!data || typeof data !== "object") return;
      if (data.type !== "CALIPH_PLAYER_STATE") return;

      setActiveClipId(data.clipId || null);
      setIsPlaying(Boolean(data.isPlaying));

      if (data.clipId) {
        setClipTimes((prev) => ({
          ...prev,
          [data.clipId]: Number(data.clipElapsed || 0)
        }));

        setClipProgress((prev) => ({
          ...prev,
          [data.clipId]: Number(data.clipProgress || 0)
        }));
      }
    }

    window.addEventListener("message", onPlayerState);
    return () => window.removeEventListener("message", onPlayerState);
  }, []);

  function playClip(msg: Message) {
    const clip = msg.clip;
    if (!clip?.file) {
      console.error("Clip file missing", clip);
      return;
    }

    const sameClip = activeClipId === clip.id;

    if (sameClip) {
      window.postMessage(
        { type: isPlaying ? "CALIPH_PLAYER_PAUSE" : "CALIPH_PLAYER_PLAY" },
        "*"
      );
      return;
    }

    window.postMessage(
      {
        type: "CALIPH_PLAYER_TOGGLE_TRACK",
        startIndex: 0,
        tracks: [
          {
            slug: `friends-clip-${clip.id}`,
            title: clip.playlist_song_title || `CALIPH - ${conversation.title}`,
            artist: clip.playlist_song_artist || conversation.subtitle || "",
            displayTitle: conversation.title,
            description: msg.audio_label || clip.clip_title,
            file: clip.file,
            clipId: clip.id,
            clipStartSeconds: clip.start_seconds,
            clipEndSeconds: clip.end_seconds,
            playlistSongSlug: clip.playlist_song_slug || null,
            analyticsSongSlug: clip.playlist_song_slug || null
          }
        ]
      },
      "*"
    );
  }

  return (
    <main className="friends-thread-screen">
      <div className="friends-thread-shell">
        <div className="friends-thread-header">
          <a href="/apps/friends" className="friends-thread-back">
            ‹ Fri.ends
          </a>

          <div className="friends-thread-center">
            <div className="friends-thread-avatar">
              {conversation.avatar_letter || conversation.title?.[0] || "V"}
            </div>

            <div className="friends-thread-meta">
              <div className="friends-thread-title">{conversation.title}</div>
              <div className="friends-thread-subtitle">
                {conversation.subtitle || ""}
              </div>
            </div>
          </div>

          <div className="friends-thread-actions">
            <button className="friends-thread-action">⌄</button>
            <button className="friends-thread-action">◻︎</button>
          </div>
        </div>

        <div className="friends-thread-messages">
          {messages.map((msg) => {
            if (
              msg.message_type === "timestamp" ||
              msg.message_type === "system" ||
              msg.message_side === "center"
            ) {
              return (
                <div key={msg.id} className="friends-center-line">
                  {msg.body}
                </div>
              );
            }

            if (msg.message_type === "audio" && msg.clip) {
              const isActive = activeClipId === msg.clip.id;
              const playing = isActive && isPlaying;
              const progress = clipProgress[msg.clip.id] || 0;
              const elapsed = clipTimes[msg.clip.id] || 0;
              const side = msg.message_side === "outgoing" ? "outgoing" : "incoming";

              const durationText =
                playing || isActive
                  ? formatTime(elapsed)
                  : msg.clip.display_duration ||
                    (msg.clip.end_seconds != null
                      ? formatTime(msg.clip.end_seconds - msg.clip.start_seconds)
                      : "0:00");

              return (
                <div key={msg.id} className={`friends-message-block ${side}`}>
                  {msg.sender_label && side === "incoming" ? (
                    <div className="friends-sender-label">{msg.sender_label}</div>
                  ) : null}

                  <button
                    type="button"
                    className={`friends-audio-bubble ${side}`}
                    onClick={() => playClip(msg)}
                    aria-label={`Play ${msg.audio_label || msg.clip.clip_title || "audio clip"}`}
                  >
                    <div className={`friends-audio-play ${playing ? "is-playing" : ""}`}>
                      {playing ? "❚❚" : "▶"}
                    </div>

                    <div className="friends-audio-wave-wrap">
                      <div
                        className="friends-audio-wave-progress"
                        style={{ width: `${progress * 100}%` }}
                      />
                      <div className="friends-audio-wave">
                        {Array.from({ length: 24 }).map((_, i) => (
                          <span
                            key={i}
                            className="friends-audio-bar"
                            style={{
                              height: `${10 + ((i * 7) % 18)}px`
                            }}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="friends-audio-time">{durationText}</div>

                    <div className="friends-audio-meta">
                      <div className="friends-audio-label">
                        {msg.audio_label || msg.clip.clip_title}
                      </div>
                      <div className="friends-audio-kind">
                        {msg.audio_kind || "VOICE NOTE"}
                      </div>
                    </div>
                  </button>
                </div>
              );
            }

            const side = msg.message_side === "outgoing" ? "outgoing" : "incoming";

            return (
              <div key={msg.id} className={`friends-message-block ${side}`}>
                {msg.sender_label && side === "incoming" ? (
                  <div className="friends-sender-label">{msg.sender_label}</div>
                ) : null}

                <div className={`friends-bubble ${side}`}>{msg.body}</div>
              </div>
            );
          })}
        </div>

        <div className="friends-thread-inputbar">
          <button className="friends-plus-btn">＋</button>

          <div className="friends-input-pill">
            <span className="friends-input-placeholder">iMessage</span>
            <span className="friends-input-mic">◖</span>
          </div>
        </div>
      </div>
    </main>
  );
}