"use client";

import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

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
  const router = useRouter();

  const [activeClipId, setActiveClipId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [clipProgress, setClipProgress] = useState<Record<string, number>>({});
  const [clipTimes, setClipTimes] = useState<Record<string, number>>({});
  const [isEntered, setIsEntered] = useState(false);
  const [isLeavingBack, setIsLeavingBack] = useState(false);

  const bottomAnchorRef = useRef<HTMLDivElement | null>(null);
  const backTimeoutRef = useRef<number | null>(null);

  function formatTime(seconds: number) {
    const s = Math.max(0, Math.floor(seconds));
    const mm = Math.floor(s / 60);
    const ss = s % 60;
    return `${mm}:${String(ss).padStart(2, "0")}`;
  }

  useEffect(() => {
    const raf = window.requestAnimationFrame(() => {
      setIsEntered(true);
    });

    return () => window.cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    return () => {
      if (backTimeoutRef.current) {
        window.clearTimeout(backTimeoutRef.current);
      }
    };
  }, []);

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

  useLayoutEffect(() => {
    const scrollToBottom = () => {
      bottomAnchorRef.current?.scrollIntoView({
        block: "end",
        behavior: "auto"
      });
    };

    scrollToBottom();

    const t1 = window.setTimeout(scrollToBottom, 0);
    const t2 = window.setTimeout(scrollToBottom, 60);
    const t3 = window.setTimeout(scrollToBottom, 180);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [conversation.slug, messages.length]);

  function handleBackToInbox() {
    if (isLeavingBack) return;

    setIsLeavingBack(true);

    backTimeoutRef.current = window.setTimeout(() => {
      router.push("/apps/friends");
    }, 220);
  }

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
            analyticsSongSlug: clip.playlist_song_slug || null,
            sourceApp: "friends",
            conversationSlug: conversation.slug,
            conversationRoute: `/apps/friends/${conversation.slug}`,
            isFriendsFinal: false
          }
        ]
      },
      "*"
    );
  }

  function renderTimestamp(msg: Message) {
    return (
      <div key={msg.id} className="friends-original-timestamp">
        {msg.body}
      </div>
    );
  }

  function renderText(msg: Message) {
    const side = msg.message_side === "outgoing" ? "outgoing" : "incoming";

    return (
      <div key={msg.id} className={`friends-original-message-row ${side}`}>
        <div className="friends-original-message-group">
          {side === "incoming" && msg.sender_label ? (
            <div className="friends-original-message-label">
              {msg.sender_label}
            </div>
          ) : null}

          <div className="friends-original-message-bubble">{msg.body}</div>
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

    const heights = [8, 12, 18, 24, 30, 16, 22, 10, 14, 26, 20];
    const bars = Array.from({ length: 28 });
    const playedCount = Math.round(progress * bars.length);

    return (
      <div key={msg.id} className={`friends-original-message-row ${side}`}>
        <div className="friends-original-message-group">
          {side === "incoming" && msg.sender_label ? (
            <div className="friends-original-message-label">
              {msg.sender_label}
            </div>
          ) : null}

          <button
            type="button"
            className={`friends-original-audio-card ${playing ? "is-playing" : ""}`}
            onClick={() => playClip(msg)}
            aria-label={`Play ${msg.audio_label || clip.clip_title || "audio clip"}`}
          >
            <div className="friends-original-audio-card-top">
              <span className="friends-original-audio-play"></span>

              <div className="friends-original-wave-wrap">
                <div className="friends-original-waveform">
                  {bars.map((_, i) => (
                    <span
                      key={i}
                      className={i < playedCount ? "is-played" : ""}
                      style={{ height: `${heights[i % heights.length]}px` }}
                    />
                  ))}
                </div>

                <div className="friends-original-audio-duration">
                  {durationText}
                </div>
              </div>
            </div>

            <div className="friends-original-audio-meta">
              <div className="friends-original-audio-file-name">
                {msg.audio_label || clip.clip_title}
              </div>
              <div className="friends-original-audio-kind">
                {msg.audio_kind || "Voice note"}
              </div>
            </div>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={[
        "app-shell",
        "friends-original-app-shell",
        "friends-thread-transition",
        isEntered ? "is-entered" : "",
        isLeavingBack ? "is-leaving-back" : ""
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <section
        className="screen screen-thread is-active"
        aria-label="Conversation thread"
      >
        <div className="friends-original-thread-topbar top-safe">
          <button
            type="button"
            onClick={handleBackToInbox}
            className="friends-original-back-btn"
            aria-label="Back to inbox"
          >
            <span
              className="friends-original-back-chevron"
              aria-hidden="true"
            ></span>
            <span className="friends-original-back-text">Fri.ends</span>
          </button>

          <div className="friends-original-thread-header-card">
            <div className="friends-original-thread-header-meta">
              <div className="friends-original-thread-avatar friends-original-thread-avatar--header">
                {conversation.avatar_letter || conversation.title?.[0] || "F"}
              </div>

              <div className="friends-original-thread-header-text">
                <div className="friends-original-thread-header-title">
                  {conversation.title}
                </div>
                <div className="friends-original-thread-header-subtitle">
                  {conversation.subtitle || ""}
                </div>
              </div>
            </div>
          </div>
        </div>

        <main className="friends-original-messages-wrap">
          <div className="friends-original-messages">
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

            <div ref={bottomAnchorRef} style={{ height: 120 }} />
          </div>
        </main>

        <div className="friends-original-message-composer bottom-safe">
          <button
            className="friends-original-composer-plus friends-original-circle-btn"
            type="button"
            aria-label="Add"
          >
            <img
              src="/apps/friends/plus.png"
              alt="Add"
              className="friends-compose-icon"
            />
          </button>

          <div className="friends-original-composer-input-wrap">
            <div className="friends-original-composer-input">iMessage</div>
            <button
              className="friends-original-composer-mic"
              type="button"
              aria-label="Voice message"
            >
              <img
                src="/apps/friends/mic_convo.png"
                alt="Mic"
                className="friends-convo-mic-icon"
              />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}