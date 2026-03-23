"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type GlobalTrack = {
  id?: string;
  slug?: string;
  title: string;
  date?: string;
  duration?: string;
  file: string;
  transcript?: string;
  description?: string;
};

type Props = {
  email: string;
};

export default function GlobalPlayer({ email }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [queue, setQueue] = useState<GlobalTrack[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  const currentTrack = useMemo(() => {
    if (currentIndex < 0 || currentIndex >= queue.length) return null;
    return queue[currentIndex];
  }, [queue, currentIndex]);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      const data = event.data;
      if (!data || typeof data !== "object") return;

      if (data.type === "CALIPH_PLAYER_LOAD_QUEUE") {
        const tracks = Array.isArray(data.tracks) ? data.tracks : [];
        const startIndex = typeof data.startIndex === "number" ? data.startIndex : 0;

        setQueue(tracks);
        setCurrentIndex(startIndex);
        setExpanded(true);
      }

      if (data.type === "CALIPH_PLAYER_TOGGLE_TRACK") {
        const tracks = Array.isArray(data.tracks) ? data.tracks : [];
        const startIndex = typeof data.startIndex === "number" ? data.startIndex : 0;

        const incoming = tracks[startIndex];
        const current = currentTrack;

        const isSame =
          current &&
          incoming &&
          current.file === incoming.file;

        if (tracks.length) {
          setQueue(tracks);
          setCurrentIndex(startIndex);
          setExpanded(true);

          if (isSame && audioRef.current && !audioRef.current.paused) {
            audioRef.current.pause();
          } else {
            setTimeout(() => {
              audioRef.current?.play().catch(() => {});
            }, 0);
          }
        }
      }

      if (data.type === "CALIPH_PLAYER_PLAY") {
        audioRef.current?.play().catch(() => {});
      }

      if (data.type === "CALIPH_PLAYER_PAUSE") {
        audioRef.current?.pause();
      }
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [currentTrack]);

  useEffect(() => {
    if (!audioRef.current || !currentTrack?.file) return;

    audioRef.current.src = currentTrack.file;
    audioRef.current.load();
    audioRef.current.play().catch(() => {});
    setIsSaved(false);

    void fetch("/api/events/song-play", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        userEmail: email,
        songSlug: currentTrack.slug || null,
        sourcePath: window.location.pathname
      })
    });
  }, [currentTrack, email]);

  function playPrev() {
    if (queue.length === 0) return;
    const next = currentIndex <= 0 ? queue.length - 1 : currentIndex - 1;
    setCurrentIndex(next);
  }

  function playNext() {
    if (queue.length === 0) return;
    const next = currentIndex >= queue.length - 1 ? 0 : currentIndex + 1;
    setCurrentIndex(next);
  }

  async function togglePlaylistSave() {
    if (!currentTrack?.slug) return;

    const res = await fetch("/api/playlists/toggle-favorite", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        userEmail: email,
        songSlug: currentTrack.slug
      })
    });

    const data = await res.json();
    if (data?.ok) setIsSaved(Boolean(data.saved));
  }

  if (!currentTrack) return null;

  return (
    <>
      <audio
        ref={audioRef}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={playNext}
      />

      <div className={`global-player ${expanded ? "is-expanded" : ""}`}>
        <button
          className="global-player-minibar"
          onClick={() => setExpanded((v) => !v)}
          aria-label="Toggle player"
        >
          <div className="global-player-text">
            <div className="global-player-title">{currentTrack.title}</div>
            <div className="global-player-subtitle">
              {currentTrack.description || "Now playing"}
            </div>
          </div>
          <div className="global-player-mini-controls">
            <span>{isPlaying ? "⏸" : "▶"}</span>
          </div>
        </button>

        <div className="global-player-panel">
          <div className="global-player-row">
            <button onClick={playPrev} className="gp-btn" aria-label="Previous">
              ⏮
            </button>

            <button
              onClick={() => {
                if (!audioRef.current) return;
                if (audioRef.current.paused) {
                  audioRef.current.play().catch(() => {});
                } else {
                  audioRef.current.pause();
                }
              }}
              className="gp-btn gp-btn-main"
              aria-label="Play or pause"
            >
              {isPlaying ? "⏸" : "▶"}
            </button>

            <button onClick={playNext} className="gp-btn" aria-label="Next">
              ⏭
            </button>

            <button
              onClick={togglePlaylistSave}
              className={`gp-btn gp-btn-save ${isSaved ? "is-saved" : ""}`}
              aria-label="Add to playlist"
            >
              ＋
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
