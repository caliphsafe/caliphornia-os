"use client";

import { useEffect, useMemo, useState } from "react";

type MusicSong = {
  id: string;
  slug: string;
  title: string;
  artist: string;
  projectName: string;
  projectSlug: string;
  appSlug: string;
  coverUrl: string | null;
  durationLabel: string;
  accessLabel: string;
  canPlay: boolean;
  isPreview: boolean;
  isFavorite: boolean;
  favoriteId: string | null;
  favoriteOrder: number | null;
  shareable: boolean;
  sharesRemaining: number;
};

type MusicData = {
  ok: boolean;
  songs: MusicSong[];
  favorites: MusicSong[];
  projects: Array<{
    slug: string;
    name: string;
    count: number;
  }>;
  error?: string;
};

function playerTracks(queue: MusicSong[]) {
  return queue.map((song) => ({
    id: song.id,
    songId: song.id,
    slug: song.slug,
    songSlug: song.slug,
    title: song.title,
    displayTitle: song.title,
    artist: song.artist,
    playlistSongSlug: song.slug,
    analyticsSongSlug: song.slug,
    sourceApp: song.appSlug || "music",
    coverUrl: song.coverUrl,
    isPreview: song.isPreview,
  }));
}

function playInGlobalPlayer(
  song: MusicSong,
  queue: MusicSong[],
) {
  const usableQueue = queue.length ? queue : [song];
  const startIndex = Math.max(
    0,
    usableQueue.findIndex((item) => item.id === song.id),
  );

  window.postMessage(
    {
      type: "CALIPH_PLAYER_TOGGLE_TRACK",
      tracks: playerTracks(usableQueue),
      startIndex,
    },
    "*",
  );
}

function shareHref(song: MusicSong) {
  const params = new URLSearchParams({
    mode: "send",
    scope: "song",
    songId: song.id,
    songSlug: song.slug,
  });

  return `/apps/share?${params.toString()}`;
}

function compact(value: number) {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
  }).format(value || 0);
}

export default function MusicLibraryClient({
  userId,
}: {
  userId: string;
}) {
  const [data, setData] = useState<MusicData>({
    ok: false,
    songs: [],
    favorites: [],
    projects: [],
  });
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<
    "listen" | "library" | "favorites" | "projects" | "shareable"
  >("listen");
  const [query, setQuery] = useState("");
  const [selectedProject, setSelectedProject] =
    useState("all");
  const [nowPlaying, setNowPlaying] =
    useState<MusicSong | null>(null);
  const [saving, setSaving] = useState("");

  async function load() {
    setLoading(true);

    const result = await fetch("/api/music/library", {
      cache: "no-store",
    })
      .then((response) => response.json())
      .catch(() => ({
        ok: false,
        songs: [],
        favorites: [],
        projects: [],
        error: "Could not load Music.",
      }));

    setData({
      ok: Boolean(result.ok),
      songs: result.songs || [],
      favorites: result.favorites || [],
      projects: result.projects || [],
      error: result.error,
    });

    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  const filteredSongs = useMemo(() => {
    const source =
      view === "favorites"
        ? data.favorites
        : view === "shareable"
          ? data.songs.filter((song) => song.shareable)
          : data.songs;

    const term = query.trim().toLowerCase();

    return source.filter((song) => {
      const projectMatches =
        selectedProject === "all" ||
        song.projectSlug === selectedProject ||
        song.appSlug === selectedProject;

      const searchMatches =
        !term ||
        `${song.title} ${song.artist} ${song.projectName}`
          .toLowerCase()
          .includes(term);

      return projectMatches && searchMatches;
    });
  }, [
    data.songs,
    data.favorites,
    view,
    query,
    selectedProject,
  ]);

  const featured = filteredSongs[0] || data.songs[0] || null;

  function playSong(
    song: MusicSong,
    queue = filteredSongs,
  ) {
    /*
     * canPlay is supplied by the existing Music library API. Preview rows are
     * intentionally playable; only truly blocked rows are ignored.
     */
    if (song.canPlay === false) return;
    setNowPlaying(song);
    playInGlobalPlayer(song, queue.length ? queue : [song]);
  }

  async function toggleFavorite(song: MusicSong) {
    setSaving(song.id);

    const result = await fetch(
      "/api/playlists/toggle-favorite",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          songId: song.id,
          songSlug: song.slug,
        }),
      },
    )
      .then((response) => response.json())
      .catch(() => ({ ok: false }));

    setSaving("");

    if (result.ok) {
      await load();
    }
  }

  async function moveFavorite(
    song: MusicSong,
    direction: "up" | "down",
  ) {
    const favorites = [...data.favorites];
    const index = favorites.findIndex(
      (item) => item.id === song.id,
    );
    if (index < 0) return;

    const swapIndex =
      direction === "up" ? index - 1 : index + 1;

    if (
      swapIndex < 0 ||
      swapIndex >= favorites.length
    ) {
      return;
    }

    [favorites[index], favorites[swapIndex]] = [
      favorites[swapIndex],
      favorites[index],
    ];

    setData((current) => ({
      ...current,
      favorites,
    }));

    await fetch("/api/music/favorites/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        songIds: favorites.map((item) => item.id),
      }),
    }).catch(() => {});

    await load();
  }

  return (
    <main className="apple-music-page cos-uniform-page">
      <section className="apple-music-shell cos-uniform-shell">
        <header className="apple-music-topbar cos-page-topbar">
          <a href="/home" className="apple-music-pill">
            ‹ Home
          </a>
          <div className="apple-music-top-actions">
            <a
              href="/apps/share"
              className="apple-music-pill"
            >
              Share
            </a>
            <a
              href="/apps/account"
              className="apple-music-pill"
            >
              Account
            </a>
          </div>
        </header>

        <section className="apple-music-hero">
          <div>
            <p>Caliphornia Music</p>
            <h1>Listen Now</h1>
            <span>
              {data.songs.length} songs ·{" "}
              {data.favorites.length} favorites ·{" "}
              {data.projects.length} projects
            </span>
          </div>

          {featured ? (
            <button
              className="apple-music-hero-art"
              onClick={() => playSong(featured)}
              aria-label={`Play ${featured.title}`}
            >
              {featured.coverUrl ? (
                <img src={featured.coverUrl} alt="" />
              ) : (
                <span>♪</span>
              )}
            </button>
          ) : null}
        </section>

        {featured ? (
          <section className="apple-music-now-card">
            <div className="apple-music-art-lg">
              {featured.coverUrl ? (
                <img src={featured.coverUrl} alt="" />
              ) : (
                <span>♪</span>
              )}
            </div>

            <div>
              <p>Recommended</p>
              <h2>{featured.title}</h2>
              <span>
                {featured.artist} ·{" "}
                {featured.projectName ||
                  featured.appSlug ||
                  "Caliphornia OS"}
              </span>

              <div className="apple-music-action-row">
                <button
                  onClick={() => playSong(featured)}
                >
                  ▶ Play
                </button>

                <button
                  onClick={() =>
                    void toggleFavorite(featured)
                  }
                >
                  {featured.isFavorite
                    ? "★ Favorited"
                    : "☆ Favorite"}
                </button>

                <a href={shareHref(featured)}>
                  ⌁ Share
                </a>
              </div>
            </div>
          </section>
        ) : null}

        <section className="apple-music-search-row">
          <input
            value={query}
            onChange={(event) =>
              setQuery(event.target.value)
            }
            placeholder="Search songs, artists, projects"
          />

          <select
            value={selectedProject}
            onChange={(event) =>
              setSelectedProject(event.target.value)
            }
          >
            <option value="all">All Projects</option>
            {data.projects.map((project) => (
              <option
                key={project.slug}
                value={project.slug}
              >
                {project.name}
              </option>
            ))}
          </select>
        </section>

        <nav
          className="apple-music-tabs"
          aria-label="Music sections"
        >
          <button
            className={
              view === "listen" ? "active" : ""
            }
            onClick={() => setView("listen")}
          >
            Listen Now
          </button>
          <button
            className={
              view === "library" ? "active" : ""
            }
            onClick={() => setView("library")}
          >
            Songs
          </button>
          <button
            className={
              view === "favorites" ? "active" : ""
            }
            onClick={() => setView("favorites")}
          >
            Favorites
          </button>
          <button
            className={
              view === "projects" ? "active" : ""
            }
            onClick={() => setView("projects")}
          >
            Projects
          </button>
          <button
            className={
              view === "shareable" ? "active" : ""
            }
            onClick={() => setView("shareable")}
          >
            Shareable
          </button>
        </nav>

        {loading ? (
          <div className="apple-music-empty">
            Loading your Music app...
          </div>
        ) : null}

        {!loading && data.error ? (
          <div className="apple-music-empty">
            {data.error}
          </div>
        ) : null}

        {view === "projects" ? (
          <section className="apple-music-project-grid">
            {data.projects.map((project) => (
              <button
                key={project.slug}
                onClick={() => {
                  setSelectedProject(project.slug);
                  setView("library");
                }}
              >
                <span>Project</span>
                <strong>{project.name}</strong>
                <small>
                  {compact(project.count)} songs
                </small>
              </button>
            ))}
          </section>
        ) : (
          <section className="apple-music-list">
            {filteredSongs.map((song, index) => (
              <article
                className={`apple-music-row ${
                  nowPlaying?.id === song.id
                    ? "is-playing"
                    : ""
                }`}
                key={song.id}
              >
                <button
                  className="apple-music-row-art"
                  onClick={() => playSong(song)}
                  disabled={!song.canPlay}
                >
                  {song.coverUrl ? (
                    <img src={song.coverUrl} alt="" />
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </button>

                <button
                  className="apple-music-row-main"
                  onClick={() => playSong(song)}
                  disabled={!song.canPlay}
                >
                  <strong>{song.title}</strong>
                  <span>
                    {song.artist} ·{" "}
                    {song.projectName ||
                      song.appSlug ||
                      "Caliphornia"}
                  </span>
                  <small>
                    {song.accessLabel}
                    {song.durationLabel
                      ? ` · ${song.durationLabel}`
                      : ""}
                  </small>
                </button>

                <div className="apple-music-row-actions">
                  <button
                    title="Play"
                    onClick={() => playSong(song)}
                    disabled={!song.canPlay}
                  >
                    ▶
                  </button>

                  <button
                    title={
                      song.isFavorite
                        ? "Remove from Favorites"
                        : "Add to Favorites"
                    }
                    disabled={saving === song.id}
                    onClick={() =>
                      void toggleFavorite(song)
                    }
                  >
                    {song.isFavorite ? "★" : "☆"}
                  </button>

                  <a
                    href={shareHref(song)}
                    title="Share"
                    aria-label={`Share ${song.title}`}
                  >
                    ⌁
                  </a>

                  {view === "favorites" ? (
                    <>
                      <button
                        title="Move up"
                        onClick={() =>
                          void moveFavorite(song, "up")
                        }
                      >
                        ↑
                      </button>
                      <button
                        title="Move down"
                        onClick={() =>
                          void moveFavorite(song, "down")
                        }
                      >
                        ↓
                      </button>
                    </>
                  ) : null}
                </div>
              </article>
            ))}

            {!loading && !filteredSongs.length ? (
              <div className="apple-music-empty">
                No songs found in this view yet.
              </div>
            ) : null}
          </section>
        )}

        {view === "favorites" ? (
          <section className="apple-music-note-card">
            <strong>Edit your Favorites playlist</strong>
            <span>
              Use the arrows to reorder songs. Favorite
              and Share remain separate actions.
            </span>
          </section>
        ) : null}
      </section>
    </main>
  );
}
