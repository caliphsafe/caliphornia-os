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
  projects: Array<{ slug: string; name: string; count: number }>;
  error?: string;
};

function sendToPlayer(song: MusicSong, queue: MusicSong[] = [song]) {
  const startIndex = Math.max(0, queue.findIndex((item) => item.id === song.id));
  window.postMessage(
    {
      type: "CALIPH_PLAYER_LOAD_QUEUE",
      tracks: queue.map((item) => ({
        id: item.id,
        songId: item.id,
        slug: item.slug,
        songSlug: item.slug,
        title: item.title,
        artist: item.artist,
        displayTitle: item.title,
        playlistSongSlug: item.slug,
        analyticsSongSlug: item.slug,
        sourceApp: item.appSlug || "music",
        coverUrl: item.coverUrl,
      })),
      startIndex,
    },
    "*"
  );
}

function compact(value: number) {
  return new Intl.NumberFormat("en-US", { notation: "compact" }).format(value || 0);
}

export default function MusicLibraryClient({ userId }: { userId: string }) {
  const [data, setData] = useState<MusicData>({ ok: false, songs: [], favorites: [], projects: [] });
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"listen" | "library" | "favorites" | "projects" | "shareable">("listen");
  const [query, setQuery] = useState("");
  const [selectedProject, setSelectedProject] = useState("all");
  const [nowPlaying, setNowPlaying] = useState<MusicSong | null>(null);
  const [shareStatus, setShareStatus] = useState("");
  const [saving, setSaving] = useState("");

  async function load() {
    setLoading(true);
    const result = await fetch("/api/music/library", { cache: "no-store" })
      .then((res) => res.json())
      .catch(() => ({ ok: false, songs: [], favorites: [], projects: [], error: "Could not load Music." }));
    setData({ ok: Boolean(result.ok), songs: result.songs || [], favorites: result.favorites || [], projects: result.projects || [], error: result.error });
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

    const q = query.trim().toLowerCase();
    return source.filter((song) => {
      const matchesProject = selectedProject === "all" || song.projectSlug === selectedProject || song.appSlug === selectedProject;
      const matchesQuery = !q || `${song.title} ${song.artist} ${song.projectName}`.toLowerCase().includes(q);
      return matchesProject && matchesQuery;
    });
  }, [data.songs, data.favorites, view, query, selectedProject]);

  const featured = filteredSongs[0] || data.songs[0] || null;
  const favoriteQueue = data.favorites.length ? data.favorites : data.songs;

  async function toggleFavorite(song: MusicSong) {
    setSaving(song.id);
    const result = await fetch("/api/playlists/toggle-favorite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ songId: song.id, songSlug: song.slug }),
    }).then((res) => res.json()).catch(() => ({ ok: false }));
    setSaving("");
    if (result.ok) await load();
  }

  async function moveFavorite(song: MusicSong, direction: "up" | "down") {
    const favorites = [...data.favorites];
    const index = favorites.findIndex((item) => item.id === song.id);
    if (index < 0) return;
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= favorites.length) return;
    const swapped = [...favorites];
    [swapped[index], swapped[swapIndex]] = [swapped[swapIndex], swapped[index]];
    setData((current) => ({ ...current, favorites: swapped }));
    await fetch("/api/music/favorites/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ songIds: swapped.map((item) => item.id) }),
    }).catch(() => {});
    await load();
  }

  async function startShare(song: MusicSong) {
    setShareStatus("Starting nearby Share...");
    const result = await fetch("/api/share/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shareScope: "song", songId: song.id, songSlug: song.slug }),
    }).then((res) => res.json()).catch(() => ({ ok: false, error: "Could not start Share." }));

    if (result.ok) {
      setShareStatus(`${song.title} is ready nearby. The receiver opens Caliphornia OS and taps Receive.`);
    } else {
      setShareStatus(result.error || "Could not start Share.");
    }
  }

  function playSong(song: MusicSong, queue = filteredSongs) {
    setNowPlaying(song);
    sendToPlayer(song, queue.length ? queue : [song]);
  }

  return (
    <main className="apple-music-page cos-uniform-page">
      <section className="apple-music-shell cos-uniform-shell">
        <header className="apple-music-topbar cos-page-topbar">
          <a href="/home" className="apple-music-pill">‹ Home</a>
          <div className="apple-music-top-actions">
            <a href="/apps/share" className="apple-music-pill">Share</a>
            <a href="/apps/account" className="apple-music-pill">Account</a>
          </div>
        </header>

        <section className="apple-music-hero">
          <div>
            <p>Caliphornia Music</p>
            <h1>Listen Now</h1>
            <span>{data.songs.length} songs · {data.favorites.length} favorites · {data.projects.length} projects</span>
          </div>
          {featured ? (
            <button className="apple-music-hero-art" onClick={() => playSong(featured)} aria-label={`Play ${featured.title}`}>
              {featured.coverUrl ? <img src={featured.coverUrl} alt="" /> : <span>♪</span>}
            </button>
          ) : null}
        </section>

        {featured ? (
          <section className="apple-music-now-card">
            <div className="apple-music-art-lg">
              {featured.coverUrl ? <img src={featured.coverUrl} alt="" /> : <span>♪</span>}
            </div>
            <div>
              <p>Recommended</p>
              <h2>{featured.title}</h2>
              <span>{featured.artist} · {featured.projectName || featured.appSlug || "Caliphornia OS"}</span>
              <div className="apple-music-action-row">
                <button onClick={() => playSong(featured)}>▶ Play</button>
                <button onClick={() => toggleFavorite(featured)}>{featured.isFavorite ? "♥ Saved" : "♡ Favorite"}</button>
                <button onClick={() => startShare(featured)}>⌁ Share</button>
              </div>
            </div>
          </section>
        ) : null}

        <section className="apple-music-search-row">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search songs, artists, projects" />
          <select value={selectedProject} onChange={(event) => setSelectedProject(event.target.value)}>
            <option value="all">All Projects</option>
            {data.projects.map((project) => <option key={project.slug} value={project.slug}>{project.name}</option>)}
          </select>
        </section>

        <nav className="apple-music-tabs" aria-label="Music sections">
          <button className={view === "listen" ? "active" : ""} onClick={() => setView("listen")}>Listen Now</button>
          <button className={view === "library" ? "active" : ""} onClick={() => setView("library")}>Songs</button>
          <button className={view === "favorites" ? "active" : ""} onClick={() => setView("favorites")}>Favorites</button>
          <button className={view === "projects" ? "active" : ""} onClick={() => setView("projects")}>Projects</button>
          <button className={view === "shareable" ? "active" : ""} onClick={() => setView("shareable")}>Shareable</button>
        </nav>

        {shareStatus ? <div className="apple-music-share-status">{shareStatus}</div> : null}
        {loading ? <div className="apple-music-empty">Loading your Music app...</div> : null}
        {!loading && data.error ? <div className="apple-music-empty">{data.error}</div> : null}

        {view === "projects" ? (
          <section className="apple-music-project-grid">
            {data.projects.map((project) => (
              <button key={project.slug} onClick={() => { setSelectedProject(project.slug); setView("library"); }}>
                <span>Project</span>
                <strong>{project.name}</strong>
                <small>{compact(project.count)} songs</small>
              </button>
            ))}
          </section>
        ) : (
          <section className="apple-music-list">
            {filteredSongs.map((song, index) => (
              <article className={`apple-music-row ${nowPlaying?.id === song.id ? "is-playing" : ""}`} key={song.id}>
                <button className="apple-music-row-art" onClick={() => playSong(song)}>
                  {song.coverUrl ? <img src={song.coverUrl} alt="" /> : <span>{index + 1}</span>}
                </button>
                <button className="apple-music-row-main" onClick={() => playSong(song)}>
                  <strong>{song.title}</strong>
                  <span>{song.artist} · {song.projectName || song.appSlug || "Caliphornia"}</span>
                  <small>{song.accessLabel}{song.durationLabel ? ` · ${song.durationLabel}` : ""}</small>
                </button>
                <div className="apple-music-row-actions">
                  <button title="Play" onClick={() => playSong(song)}>▶</button>
                  <button title="Favorite" disabled={saving === song.id} onClick={() => toggleFavorite(song)}>{song.isFavorite ? "♥" : "♡"}</button>
                  <button title="Share nearby" onClick={() => startShare(song)}>⌁</button>
                  {view === "favorites" ? (
                    <>
                      <button title="Move up" onClick={() => moveFavorite(song, "up")}>↑</button>
                      <button title="Move down" onClick={() => moveFavorite(song, "down")}>↓</button>
                    </>
                  ) : null}
                </div>
              </article>
            ))}
            {!loading && !filteredSongs.length ? <div className="apple-music-empty">No songs found in this view yet.</div> : null}
          </section>
        )}

        {view === "favorites" ? (
          <section className="apple-music-note-card">
            <strong>Edit your Favorites playlist</strong>
            <span>Use the up and down arrows to reorder songs. The global player will follow this order when you play from Favorites.</span>
          </section>
        ) : null}
      </section>
    </main>
  );
}
