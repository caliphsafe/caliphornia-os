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

  function stopRaf() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  }

  function resetClipVisuals(clipId: string) {
    setClipProgress((prev) => ({ ...prev, [clipId]: 0 }));
    setClipTimes((prev) => ({ ...prev, [clipId]: 0 }));
  }

  function formatTime(seconds: number) {
    const s = Math.max(0, Math.floor(seconds));
    const mm = Math.floor(s / 60);
    const ss = s % 60;
    return `${mm}:${String(ss).padStart(2, "0")}`;
  }

  function startTracking(clip: Clip) {
    stopRaf();

    const tick = () => {
      const audio = audioRef.current;
      if (!audio) return;

      const current = audio.currentTime || 0;
      const start = clip.start_seconds || 0;
      const end = clip.end_seconds;
      const elapsed = Math.max(0, current - start);

      setClipTimes((prev) => ({ ...prev, [clip.id]: elapsed }));

      if (end != null) {
        const duration = Math.max(0.001, end - start);
        const progress = Math.min(1, elapsed / duration);
        setClipProgress((prev) => ({ ...prev, [clip.id]: progress }));

        if (current >= end) {
          audio.pause();
          setIsPlaying(false);
          stopRaf();
          return;
        }
      } else {
        const duration = audio.duration && Number.isFinite(audio.duration) ? audio.duration : 0;
        const progress = duration > 0 ? Math.min(1, current / duration) : 0;
        setClipProgress((prev) => ({ ...prev, [clip.id]: progress }));
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  }

  async function loadAndPlayClip(clip: Clip) {
    const audio = audioRef.current;
    if (!audio || !clip.file) return;

    stopRaf();
    setIsPlaying(false);

    const start = clip.start_seconds || 0;
    const sameSource = audio.src === clip.file;

    if (!sameSource) {
      audio.pause();
      audio.src = clip.file;
      audio.load();
    }

    setActiveClipId(clip.id);
    resetClipVisuals(clip.id);

    const beginPlayback = async () => {
      try {
        audio.currentTime = start;
      } catch {}

      try {
        await audio.play();
        setIsPlaying(true);
        startTracking(clip);
      } catch (err) {
        console.error("Audio play failed:", err);
      }
    };

    if (!sameSource) {
      const onCanPlay = async () => {
        audio.removeEventListener("canplay", onCanPlay);
        await beginPlayback();
      };

      audio.addEventListener("canplay", onCanPlay, { once: true });
      return;
    }

    await beginPlayback();
  }

  async function toggleClip(clip: Clip) {
    const audio = audioRef.current;
    if (!audio || !clip.file) {
      console.error("Missing audio element or clip file", clip);
      return;
    }

    const sameClip = activeClipId === clip.id;

    if (sameClip && !audio.paused) {
      audio.pause();
      setIsPlaying(false);
      stopRaf();
      return;
    }

    await loadAndPlayClip(clip);
  }

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    function onPlay() {
      setIsPlaying(true);
    }

    function onPause() {
      setIsPlaying(false);
      stopRaf();
    }

    function onEnded() {
      setIsPlaying(false);
      stopRaf();
    }

    function onError() {
      const currentAudio = audioRef.current;
      console.error("Audio element error", currentAudio?.error ?? null);
    }

    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);

    return () => {
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
      stopRaf();
    };
  }, []);

  return (
    <>
      <audio ref={audioRef} preload="metadata" playsInline />

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
                      onClick={() => toggleClip(msg.clip!)}
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