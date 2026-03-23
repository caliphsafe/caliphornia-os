"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type GlobalTrack = {
  id?: string | null;
  slug?: string | null;
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

function cleanTrackTitle(title: string) {
  return String(title || "").replace(/^CALIPH\s*-\s*/i, "").trim();
}

function IconPrev() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="gp-icon">
      <path
        d="M7 6v12M18 7l-7 5 7 5V7Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconNext() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="gp-icon">
      <path
        d="M17 6v12M6 7l7 5-7 5V7Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconPlay() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="gp-icon gp-icon-play">
      <path d="M8 6.5v11l9-5.5-9-5.5Z" fill="currentColor" />
    </svg>
  );
}

function IconPause() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="gp-icon">
      <path d="M8 6h3v12H8zM13 6h3v12h-3z" fill="currentColor" />
    </svg>
  );
}

function IconAdd() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="gp-icon">
      <path
        d="M12 5v14M5 12h14"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconMinimize() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="gp-icon gp-icon-small">
      <path
        d="M7 12h10"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function GlobalPlayer({ email }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [queue, setQueue] = useState<GlobalTrack[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [isVisible, setIsVisible] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  const currentTrack = useMemo(() => {
    if (currentIndex < 0 || currentIndex >= queue.length) return null;
    return queue[currentIndex];
  }, [queue, currentIndex]);

  function broadcastState() {
    const audio = audioRef.current;
    const payload = {
      type: "CALIPH_PLAYER_STATE",
      slug: currentTrack?.slug || null,
      isPlaying: audio ? !audio.paused : false,
      currentTime: audio?.currentTime || 0,
      duration: audio?.duration || 0
    };

    document.querySelectorAll("iframe").forEach((frame) => {
      frame.contentWindow?.postMessage(payload, "*");
    });
  }

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      const data = event.data;
      if (!data || typeof data !== "object") return;

      if (data.type === "CALIPH_PLAYER_LOAD_QUEUE") {
        const tracks = Array.isArray(data.tracks) ? data.tracks : [];
        const startIndex = typeof data.startIndex === "number" ? data.startIndex : 0;
        if (!tracks.length) return;

        setQueue(tracks);
        setCurrentIndex(startIndex);
        setIsVisible(true);
        setIsExpanded(true);
      }

      if (data.type === "CALIPH_PLAYER_TOGGLE_TRACK") {
        const tracks = Array.isArray(data.tracks) ? data.tracks : [];
        const startIndex = typeof data.startIndex === "number" ? data.startIndex : 0;
        if (!tracks.length) return;

        const incoming = tracks[startIndex];
        const same =
          currentTrack &&
          incoming &&
          currentTrack.slug &&
          incoming.slug &&
          currentTrack.slug === incoming.slug;

        if (same && audioRef.current) {
          if (audioRef.current.paused) {
            audioRef.current.play().catch(() => {});
          } else {
            audioRef.current.pause();
          }
          return;
        }

        setQueue(tracks);
        setCurrentIndex(startIndex);
        setIsVisible(true);
        setIsExpanded(true);
      }

      if (data.type === "CALIPH_PLAYER_PLAY") {
        audioRef.current?.play().catch(() => {});
      }

      if (data.type === "CALIPH_PLAYER_PAUSE") {
        audioRef.current?.pause();
      }

      if (data.type === "CALIPH_PLAYER_SEEK") {
        const delta = Number(data.delta || 0);
        if (audioRef.current) {
          audioRef.current.currentTime = Math.max(0, (audioRef.current.currentTime || 0) + delta);
          broadcastState();
        }
      }
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [currentTrack]);

  useEffect(() => {
    if (!audioRef.current || !currentTrack?.file) return;

    const audio = audioRef.current;
    audio.src = currentTrack.file;
    audio.load();
    audio.play().catch(() => {});
    setIsSaved(false);
    setIsVisible(true);
    setIsExpanded(true);

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

    setTimeout(() => broadcastState(), 50);
  }, [currentTrack, email]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const sync = () => {
      setIsPlaying(!audio.paused);
      broadcastState();
    };

    const onEnded = () => {
      playNext();
    };

    audio.addEventListener("play", sync);
    audio.addEventListener("pause", sync);
    audio.addEventListener("timeupdate", sync);
    audio.addEventListener("loadedmetadata", sync);
    audio.addEventListener("seeked", sync);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.removeEventListener("play", sync);
      audio.removeEventListener("pause", sync);
      audio.removeEventListener("timeupdate", sync);
      audio.removeEventListener("loadedmetadata", sync);
      audio.removeEventListener("seeked", sync);
      audio.removeEventListener("ended", onEnded);
    };
  }, [currentTrack, queue, currentIndex]);

  function playPrev() {
    if (!queue.length) return;
    const next = currentIndex <= 0 ? queue.length - 1 : currentIndex - 1;
    setCurrentIndex(next);
  }

  function playNext() {
    if (!queue.length) return;
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

  if (!isVisible || !currentTrack) return null;

  return (
    <>
      <audio ref={audioRef} />

      <div className={`global-player-shell ${isExpanded ? "is-expanded" : "is-collapsed"}`}>
        {isExpanded ? (
          <div className="global-player-card">
            <button
              className="global-player-collapse"
              onClick={() => setIsExpanded(false)}
              aria-label="Minimize player"
            >
              <IconMinimize />
            </button>

            <div className="global-player-main">
              <div className="global-player-copy">
                <div className="global-player-eyebrow">Now Playing</div>
                <div className="global-player-title">{cleanTrackTitle(currentTrack.title)}</div>
              </div>

              <div className="global-player-controls">
                <button onClick={playPrev} className="gp-btn" aria-label="Previous">
                  <IconPrev />
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
                  {isPlaying ? <IconPause /> : <IconPlay />}
                </button>

                <button onClick={playNext} className="gp-btn" aria-label="Next">
                  <IconNext />
                </button>

                <button
                  onClick={togglePlaylistSave}
                  className={`gp-btn gp-btn-save ${isSaved ? "is-saved" : ""}`}
                  aria-label="Add to playlist"
                >
                  <IconAdd />
                </button>
              </div>
            </div>
          </div>
        ) : (
          <button
            className="global-player-orb"
            onClick={() => setIsExpanded(true)}
            aria-label="Open player"
          >
            {isPlaying ? <IconPause /> : <IconPlay />}
          </button>
        )}
      </div>
    </>
  );
}
