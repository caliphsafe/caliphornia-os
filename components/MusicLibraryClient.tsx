"use client";

import { useEffect, useMemo, useState } from "react";
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

export default function MusicLibraryClient({ email }: Props) {
  const router = useRouter();

  const [songs, setSongs] = useState<MusicSong[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSongSlug, setActiveSongSlug] = useState<string | null>(null);

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

  useEffect(() => {
    function onPlayerState(event: MessageEvent) {
      const data = event.data;
      if (!data || typeof data !== "object") return;
      if (data.type !== "CALIPH_PLAYER_STATE") return;

      const slug =
        data.playlistSongSlug ||
        data.slug ||
        null;

      setActiveSongSlug(slug);
    }

    window.addEventListener("message", onPlayerState);
    return () => window.removeEventListener("message", onPlayerState);
  }, []);

  const playableSongs = useMemo(() => {
    return songs.filter((song) => song.file);
  }, [songs]);

  function buildQueue(items: MusicSong[]): GlobalTrack[] {
    return items
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
  }

  function playQueue(items: MusicSong[], startIndex = 0) {
    const tracks = buildQueue(items);
    if (!tracks.length) return;

    window.postMessage(
      {
        type: "CALIPH_PLAYER_LOAD_QUEUE",
        tracks,
        startIndex
      },
      "*"
    );
  }

  function playListedQueue() {
    playQueue(playableSongs, 0);
  }

  function playShuffledQueue() {
    const shuffled = shuffleArray(playableSongs);
    playQueue(shuffled, 0);
  }

  function playSongFromMainList(song: MusicSong) {
    const index = playableSongs.findIndex((item) => item.slug === song.slug);
    if (index === -1) return;
    playQueue(playableSongs, index);
  }

  function goHome() {
    router.push(`/home?email=${encodeURIComponent(email)}`);
  }

  return (
    <div className="music-app-shell">
      <div className="music-top-chrome">
        <button
          type="button"
          className="music-nav-round"
          aria-label="Back"
          onClick={goHome}
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
              onClick={playListedQueue}
              disabled={!playableSongs.length}
            >
              ▶ Play
            </button>

            <button
              type="button"
              className="music-action-pill"
              onClick={playShuffledQueue}
              disabled={!playableSongs.length}
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
              {songs.map((song) => {
                const cleanTitle = stripCaliphPrefix(song.title);
                const active = activeSongSlug === song.slug;

                return (
                  <button
                    key={song.favorite_id}
                    type="button"
                    className={`music-song-row ${active ? "is-active" : ""}`}
                    onClick={() => playSongFromMainList(song)}
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
    </div>
  );
}