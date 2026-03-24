"use client";

import Link from "next/link";
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

  function renderTimestamp(msg: Message) {
    return (
      <div key={msg.id} className="timestamp">
        {msg.body}
      </div>
    );
  }

  function renderText(msg: Message) {
    const side = msg.message_side === "outgoing" ? "outgoing" : "incoming";

    return (
      <div key={msg.id} className={`message-row ${side}`}>
        <div className="message-group">
          {side === "incoming" && msg.sender_label ? (
            <div className="message-label">{msg.sender_label}</div>
          ) : null}

          <div className="message-bubble">{msg.body}</div>
        </div>
      </div>
    );
  }

  function renderAudio(msg: Message) {
    const clip = msg.clip;
    if (!clip) return null;

    const side = msg.message_side === "outgoing" ? "outgoing" : "incoming";
    const active = activeClipId === clip.id;
    const playing = active && isPlaying;
    const progress = clipProgress[clip.id] || 0;
    const elapsed = clipTimes[clip.id] || 0;

    const durationText =
      playing || active
        ? formatTime(elapsed)
        : clip.display_duration ||
          (clip.end_seconds != null
            ? formatTime(clip.end_seconds - clip.start_seconds)
            : "0:00");

    const bars = Array.from({ length: 28 });

    return (
      <div key={msg.id} className={`message-row ${side}`}>
        <div className="message-group">
          {side === "incoming" && msg.sender_label ? (
            <div className="message-label">{msg.sender_label}</div>
          ) : null}

          <button
            type="button"
            className={`audio-card ${playing ? "is-playing" : ""}`}
            onClick={() => playClip(msg)}
            aria-label={`Play ${msg.audio_label || clip.clip_title || "audio clip"}`}
          >
            <div className="audio-card-top">
              <span className="audio-play" />

              <div className="wave-wrap">
                <div className="waveform">
                  {bars.map((_, i) => {
                    const playedCount = Math.round(progress * bars.length);
                    return (
                      <span
                        key={i}
                        className={i < playedCount ? "is-played" : ""}
                        style={{
                          height: `${[8,12,18,24,30,16,22,10,14,26,20][i % 11]}px`
                        }}
                      />
                    );
                  })}
                </div>

                <div className="audio-duration">{durationText}</div>
              </div>
            </div>

            <div className="audio-meta">
              <div className="audio-file-name">
                {msg.audio_label || clip.clip_title}
              </div>
              <div className="audio-kind">{msg.audio_kind || "Voice note"}</div>
            </div>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <section className="screen screen-thread is-active" aria-label="Conversation thread">
        <div className="thread-topbar top-safe">
          <Link href="/apps/friends" className="back-btn" aria-label="Back to inbox">
            <span className="back-chevron" aria-hidden="true"></span>
            <span className="back-text">Fri.ends</span>
          </Link>

          <div className="thread-header-meta">
            <div className="thread-avatar thread-avatar--header">
              {conversation.avatar_letter || conversation.title?.[0] || "F"}
            </div>

            <div className="thread-header-text">
              <div className="thread-header-title">{conversation.title}</div>
              <div className="thread-header-subtitle">
                {conversation.subtitle || ""}
              </div>
            </div>
          </div>

          <div className="thread-actions">
            <button className="circle-icon-btn" type="button" aria-label="Call">
              <span className="phone-icon"></span>
            </button>
            <button className="circle-icon-btn" type="button" aria-label="Video">
              <span className="video-icon"></span>
            </button>
          </div>
        </div>

        <main className="messages-wrap">
          <div className="messages">
            {messages.map((msg) => {
              if (
                msg.message_type === "timestamp" ||
                msg.message_type === "system" ||
                msg.message_side === "center"
              ) {
                return renderTimestamp(msg);
              }

              if (msg.message_type === "audio" && msg.clip) {
                return renderAudio(msg);
              }

              return renderText(msg);
            })}
          </div>
        </main>

        <div className="message-composer bottom-safe">
          <button className="composer-plus" type="button" aria-label="Add">
            <span>+</span>
          </button>

          <div className="composer-input-wrap">
            <div className="composer-input">iMessage</div>
            <button className="composer-mic" type="button" aria-label="Voice message">
              <span className="mini-mic"></span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}