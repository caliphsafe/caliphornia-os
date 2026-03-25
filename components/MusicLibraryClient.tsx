"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type MusicSong = {
  favorite_id: string;
  favorited_at: string;
  song_id: string;
  slug: string;
  title: string;
  artist: string;
  cover_image: string | null;
  file: string | null;
};

type GlobalTrack = {
  slug?: string | null;
  title: string;
  artist?: string;
  displayTitle?: string;
  description?: string;
  file: string;
  playlistSongSlug?: string | null;
  analyticsSongSlug?: string | null;
  sourceApp?: string | null;
  resumeSeconds?: number | null;
};

type Props = {
  email: string;
};

function shuffleArray<T>(items: T[]) {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function stripCaliphPrefix(title: string) {
  return String(title || "").replace(/^CALIPH\s*-\s*/i, "").trim();
}

function formatTime(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds || 0));
  const mm = Math.floor(safe / 60);
  const ss = safe % 60;
  return `${mm}:${String(ss).padStart(2, "0")}`;
}

function MarqueeText({
  text,
  active = false
}: {
  text: string;
  active?: boolean;
}) {
  const shouldMarquee = active && text.length > 22;

  if (!shouldMarquee) {
    return <span className="music-ellipsis">{text}</span>;
  }

  return (
    <span className="music-marquee-shell">
      <span className="music-marquee-track">
        <span>{text}</span>
        <span aria-hidden="true">{text}</span>
      </span>
    </span>
  );
}

export default function MusicLibraryClient({ email }: Props) {
  const router = useRouter();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [songs, setSongs] = useState<MusicSong[]>([]);
  const [loading, setLoading] = useState(true);

  const [localQueue, setLocalQueue] = useState<MusicSong[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    async function loadFavorites() {
      if (!email) {
        setSongs([]);
        setLoading(false);
        return;
      }

      try {
        const params = new URLSearchParams({ userEmail: email });
        const res = await fetch(`/api/music/favorites?${params.toString()}`, {
          cache: "no-store"
        });
        const data = await res.json();

        if (!data?.ok || !Array.isArray(data.songs)) {
          setSongs([]);
          setLoading(false);
          return;
        }

        setSongs(data.songs);
      } catch {
        setSongs([]);
      } finally {
        setLoading(false);
      }
    }

    void loadFavorites();
  }, [email]);

  const currentSong = useMemo(() => {
    if (currentIndex < 0 || currentIndex >= localQueue.length) return null;
    return localQueue[currentIndex];
  }, [localQueue, currentIndex]);

  const globalQueue = useMemo<GlobalTrack[]>(() => {
    return localQueue
      .filter((song) => song.file)
      .map((song) => ({
        slug: song.slug,
        title: `${song.artist} - ${stripCaliphPrefix(song.title)}`,
        artist: song.artist,
        displayTitle: stripCaliphPrefix(song.title),
        description: "Favorited song",
        file: song.file as string,
        playlistSongSlug: song.slug,
        analyticsSongSlug: song.slug,
        sourceApp: "music"
      }));
  }, [localQueue]);

  function loadLocalQueue(startIndex = 0, useShuffle = false) {
    const playable = songs.filter((song) => song.file);
    if (!playable.length) return;

    const queue = useShuffle ? shuffleArray(playable) : playable;
    setLocalQueue(queue);
    setCurrentIndex(startIndex);
  }

  function playSongFromMainList(index: number) {
    const playable = songs.filter((song) => song.file);
    if (!playable.length) return;

    setLocalQueue(playable);
    setCurrentIndex(index);
  }

  function playPrevLocal() {
    if (!localQueue.length) return;
    setCurrentIndex((prev) => (prev <= 0 ? localQueue.length - 1 : prev - 1));
  }

  function playNextLocal() {
    if (!localQueue.length) return;
    setCurrentIndex((prev) => (prev >= localQueue.length - 1 ? 0 : prev + 1));
  }

  function handoffToGlobalAndGoHome() {
    const audio = audioRef.current;
    const resumeSeconds = audio?.currentTime || 0;

    if (globalQueue.length && currentIndex > -1) {
      const tracks = globalQueue.map((track, index) => ({
        ...track,
        resumeSeconds: index === currentIndex ? resumeSeconds : 0
      }));

      window.postMessage(
        {
          type: "CALIPH_PLAYER_LOAD_QUEUE",
          startIndex: currentIndex,
          tracks
        },
        "*"
      );

      window.postMessage(
        {
          type: "CALIPH_PLAYER_PLAY"
        },
        "*"
      );
    }

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        router.push(`/home?email=${encodeURIComponent(email)}`);

        window.setTimeout(() => {
          window.postMessage(
            {
              type: "CALIPH_PLAYER_PLAY"
            },
            "*"
          );

          if (audio) {
            audio.pause();
          }
        }, 160);
      });
    });
  }

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentSong?.file) return;

    audio.pause();
    audio.src = currentSong.file;
    audio.load();

    const onCanPlay = async () => {
      audio.removeEventListener("canplay", onCanPlay);
      setCurrentTime(0);

      try {
        await audio.play();
      } catch (error) {
        console.error("Music app local playback failed", error);
      }
    };

    audio.addEventListener("canplay", onCanPlay, { once: true });

    return () => {
      audio.removeEventListener("canplay", onCanPlay);
    };
  }, [currentSong]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    function onPlay() {
      setIsPlaying(true);
    }

    function onPause() {
      setIsPlaying(false);
    }

    function onTimeUpdate() {
      const currentAudio = audioRef.current;
      if (!currentAudio) return;
      setCurrentTime(currentAudio.currentTime || 0);
    }

    function onEnded() {
      const currentAudio = audioRef.current;
      if (!currentAudio) return;

      setCurrentTime(0);
      setCurrentIndex((prev) =>
        prev >= localQueue.length - 1 ? 0 : prev + 1
      );
    }

    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("ended", onEnded);
    };
  }, [localQueue.length]);

  return (
    <div className="music-app-shell">
      <audio ref={audioRef} preload="metadata" />

      <div className="music-top-chrome">
        <button
          type="button"
          className="music-nav-round"
          aria-label="Back"
          onClick={handoffToGlobalAndGoHome}
        >
          <span className="music-back-chevron" />
        </button>

        <div className="music-nav-capsule" aria-hidden="true">
          <button className="music-nav-capsule-btn" type="button">
            <span className="music-person-plus">◔+</span>
          </button>
          <button className="music-nav-capsule-btn" type="button">
            <span className="music-download-arrow">↓</span>
          </button>
          <button className="music-nav-capsule-btn" type="button">
            <span className="music-dots">•••</span>
          </button>
        </div>
      </div>

      <main className="music-container">
        <section className="music-hero">
          <div className="music-hero-art">
            <div className="music-hero-title-big">Music</div>
          </div>

          <div className="music-hero-meta">
            <h1>Favorited Songs</h1>
            <p>{email || "Your library"}</p>
          </div>

          <div className="music-action-row">
            <button
              type="button"
              className="music-action-pill"
              onClick={() => loadLocalQueue(0, false)}
              disabled={!songs.length}
            >
              ▶ Play
            </button>

            <button
              type="button"
              className="music-action-pill"
              onClick={() => loadLocalQueue(0, true)}
              disabled={!songs.length}
            >
              ⇄ Shuffle
            </button>
          </div>
        </section>

        <section className="music-list-section">
          {loading ? (
            <div className="music-empty-state">Loading your library...</div>
          ) : !songs.length ? (
            <div className="music-empty-state">
              This is where the favorited songs will live.
            </div>
          ) : (
            <div className="music-song-list">
              {songs.map((song, index) => {
                const active = currentSong?.favorite_id === song.favorite_id;
                const cleanTitle = stripCaliphPrefix(song.title);

                return (
                  <button
                    key={song.favorite_id}
                    type="button"
                    className={`music-song-row ${active ? "is-active" : ""}`}
                    onClick={() => playSongFromMainList(index)}
                  >
                    <div className="music-song-left">
                      <div className="music-song-cover">
                        {song.cover_image ? (
                          <img src={song.cover_image} alt={cleanTitle} />
                        ) : (
                          <div className="music-song-cover-fallback">
                            {cleanTitle?.[0] || "♪"}
                          </div>
                        )}
                      </div>

                      <div className="music-song-copy">
                        <div className="music-song-title music-ellipsis">
                          {cleanTitle}
                        </div>
                        <div className="music-song-artist music-ellipsis">
                          {song.artist}
                        </div>
                      </div>
                    </div>

                    <div className="music-song-more">•••</div>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {currentSong ? (
        <div className="music-inline-player-shell">
          <div className="music-inline-player">
            <div className="music-inline-player-left">
              <div className="music-inline-cover">
                {currentSong.cover_image ? (
                  <img
                    src={currentSong.cover_image}
                    alt={stripCaliphPrefix(currentSong.title)}
                  />
                ) : (
                  <div className="music-inline-cover-fallback">
                    {stripCaliphPrefix(currentSong.title)?.[0] || "♪"}
                  </div>
                )}
              </div>

              <div className="music-inline-copy">
                <div className="music-inline-title">
                  <MarqueeText
                    text={stripCaliphPrefix(currentSong.title)}
                    active={true}
                  />
                </div>
                <div className="music-inline-artist music-ellipsis">
                  {currentSong.artist}
                </div>
              </div>
            </div>

            <div className="music-inline-controls">
              <button
                type="button"
                className="music-inline-btn"
                aria-label="Previous"
                onClick={playPrevLocal}
              >
                ‹‹
              </button>

              <button
                type="button"
                className="music-inline-btn music-inline-btn-main"
                aria-label="Play or pause"
                onClick={() => {
                  const audio = audioRef.current;
                  if (!audio) return;

                  if (audio.paused) {
                    audio.play().catch(() => {});
                  } else {
                    audio.pause();
                  }
                }}
              >
                {isPlaying ? "❚❚" : "▶"}
              </button>

              <button
                type="button"
                className="music-inline-btn"
                aria-label="Next"
                onClick={playNextLocal}
              >
                ››
              </button>
            </div>
          </div>

          <div className="music-inline-progress-row">
            <span>{formatTime(currentTime)}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
