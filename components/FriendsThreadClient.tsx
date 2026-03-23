"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Clip = {
  id: string;
  clip_title: string;
  start_seconds: number;
  end_seconds: number | null;
  display_duration?: string | null;
  file: string | null;
  asset?: {
    id: string;
    slug: string;
    title: string;
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
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number | null>(null);

  const [activeClipId, setActiveClipId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [clipProgress, setClipProgress] = useState<Record<string, number>>({});
  const [clipTimes, setClipTimes] = useState<Record<string, number>>({});

  const clipsById = useMemo(() => {
    const map = new Map<string, Clip>();
    for (const msg of messages) {
      if (msg.clip?.id) map.set(msg.clip.id, msg.clip);
    }
    return map;
  }, [messages]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    function stopLoop() {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    function tick() {
      const clipId = activeClipId;
      if (!clipId) return;

      const clip = clipsById.get(clipId);
      if (!clip || clip.end_seconds == null) return;

      const current = audio.currentTime || 0;
      const start = clip.start_seconds || 0;
      const end = clip.end_seconds || 0;
      const duration = Math.max(0.001, end - start);
      const elapsed = Math.max(0, current - start);
      const progress = Math.min(1, elapsed / duration);

      setClipProgress((prev) => ({ ...prev, [clipId]: progress }));
      setClipTimes((prev) => ({ ...prev, [clipId]: elapsed }));

      if (current >= end) {
        audio.pause();
        audio.currentTime = start;
        setIsPlaying(false);
        stopLoop();
        return;
      }

      rafRef.current = requestAnimationFrame(tick);
    }

    function onPlay() {
      setIsPlaying(true);
      stopLoop();
      rafRef.current = requestAnimationFrame(tick);
    }

    function onPause() {
      setIsPlaying(false);
      stopLoop();
    }

    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);

    return () => {
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      stopLoop();
    };
  }, [activeClipId, clipsById]);

  function formatTime(seconds: number) {
    const s = Math.max(0, Math.floor(seconds));
    const mm = Math.floor(s / 60);
    const ss = s % 60;
    return `${mm}:${String(ss).padStart(2, "0")}`;
  }

  async function toggleClip(clip: Clip) {
    const audio = audioRef.current;
    if (!audio || !clip.file) return;

    const sameClip = activeClipId === clip.id;
    const start = clip.start_seconds || 0;

    if (sameClip && !audio.paused) {
      audio.pause();
      return;
    }

    if (!sameClip || audio.src !== clip.file) {
      audio.src = clip.file;
      audio.load();

      const onLoaded = async () => {
        audio.currentTime = start;
        try {
          await audio.play();
        } catch {}
        audio.removeEventListener("loadedmetadata", onLoaded);
      };

      audio.addEventListener("loadedmetadata", onLoaded);
      setActiveClipId(clip.id);
      setClipProgress((prev) => ({ ...prev, [clip.id]: 0 }));
      setClipTimes((prev) => ({ ...prev, [clip.id]: 0 }));
      return;
    }

    audio.currentTime = start;
    try {
      await audio.play();
    } catch {}
  }

  return (
    <>
      <audio ref={audioRef} preload="metadata" />

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
                    : msg.clip.display_duration || "0:00";

                return (
                  <div key={msg.id} className={`friends-message-block ${side}`}>
                    {msg.sender_label && side === "incoming" ? (
                      <div className="friends-sender-label">{msg.sender_label}</div>
                    ) : null}

                    <button
                      className={`friends-audio-bubble ${side}`}
                      onClick={() => toggleClip(msg.clip!)}
                      aria-label={`Play ${msg.audio_label || msg.clip?.clip_title || "audio clip"}`}
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
                                height: `${12 + ((i * 7) % 22)}px`
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
    </>
  );
}
