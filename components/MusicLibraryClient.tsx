"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { GlobalTrack } from "@/components/GlobalPlayer";

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

export default function MusicLibraryClient({ email }: Props) {
  const [songs, setSongs] = useState<MusicSong[]>([]);
  const [loading, setLoading] = useState(true);

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

  const queue = useMemo<GlobalTrack[]>(() => {
    return songs
      .filter((song) => song.file)
      .map((song) => ({
        slug: song.slug,
        title: `${song.artist} - ${song.title}`,
        artist: song.artist,
        displayTitle: song.title,
        description: "Favorited song",
        file: song.file as string,
        playlistSongSlug: song.slug,
        analyticsSongSlug: song.slug,
        sourceApp: "music"
      }));
  }, [songs]);

  function loadQueue(startIndex = 0, useShuffle = false) {
    if (!queue.length) return;

    const tracks = useShuffle ? shuffleArray(queue) : queue;

    window.postMessage(
      {
        type: "CALIPH_PLAYER_LOAD_QUEUE",
        startIndex,
        tracks
      },
      "*"
    );
  }

  function playSong(index: number) {
    if (!queue.length) return;

    window.postMessage(
      {
        type: "CALIPH_PLAYER_LOAD_QUEUE",
        startIndex: index,
        tracks: queue
      },
      "*"
    );
  }

  return (
    <div className="music-app-shell">
      <div className="music-top-chrome">
        <Link href="/home" className="music-nav-round" aria-label="Back">
          <span className="music-back-chevron" />
        </Link>

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
              onClick={() => loadQueue(0, false)}
              disabled={!queue.length}
            >
              ▶ Play
            </button>

            <button
              type="button"
              className="music-action-pill"
              onClick={() => loadQueue(0, true)}
              disabled={!queue.length}
            >
              ⇄ Shuffle
            </button>
          </div>
        </section>

        <section className="music-list-section">
          {loading ? (
            <div className="music-empty-state">
              Loading your library...
            </div>
          ) : !songs.length ? (
            <div className="music-empty-state">
              This is where your favorited songs will live.
            </div>
          ) : (
            <div className="music-song-list">
              {songs.map((song, index) => (
                <button
                  key={song.favorite_id}
                  type="button"
                  className="music-song-row"
                  onClick={() => playSong(index)}
                >
                  <div className="music-song-left">
                    <div className="music-song-cover">
                      {song.cover_image ? (
                        <img src={song.cover_image} alt={song.title} />
                      ) : (
                        <div className="music-song-cover-fallback">
                          {song.title?.[0] || "♪"}
                        </div>
                      )}
                    </div>

                    <div className="music-song-copy">
                      <div className="music-song-title">{song.title}</div>
                      <div className="music-song-artist">{song.artist}</div>
                    </div>
                  </div>

                  <div className="music-song-more">•••</div>
                </button>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
