"use client";

import { useEffect, useMemo, useState } from "react";
import PlayButton from "@/components/music/PlayButton";
import ShareSongButton from "@/components/music/ShareSongButton";

type MusicSong = {
  id: string;
  slug: string;
  title: string;
  artist: string;
  projectName: string;
  projectSlug: string;
  appSlug: string;
  durationLabel: string;
  coverUrl?: string | null;
  favorite: boolean;
  favoriteId?: string | null;
  favoriteOrder?: number | null;
  accessLabel: string;
  shareable: boolean;
};

export default function MusicLibraryClient({ userId, email }: { userId: string; email: string }) {
  const [songs, setSongs] = useState<MusicSong[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"library" | "favorites" | "projects" | "shared">("library");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");

  async function load() {
    setLoading(true);
    const data = await fetch("/api/music/catalog", { cache: "no-store" }).then((res) => res.json()).catch(() => ({ ok: false }));
    if (data?.ok) setSongs(data.songs || []);
    else setStatus(data.error || "Could not load Music.");
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => {
    const clean = query.trim().toLowerCase();
    let rows = [...songs];
    if (mode === "favorites") rows = rows.filter((song) => song.favorite).sort((a, b) => Number(a.favoriteOrder || 9999) - Number(b.favoriteOrder || 9999));
    if (mode === "shared") rows = rows.filter((song) => song.shareable);
    if (clean) rows = rows.filter((song) => [song.title, song.artist, song.projectName, song.slug].join(" ").toLowerCase().includes(clean));
    return rows;
  }, [songs, query, mode]);

  const favorites = songs.filter((song) => song.favorite).sort((a, b) => Number(a.favoriteOrder || 9999) - Number(b.favoriteOrder || 9999));
  const projectGroups = useMemo(() => {
    const map = new Map<string, MusicSong[]>();
    songs.forEach((song) => {
      const key = song.projectName || song.projectSlug || "Caliphornia OS";
      map.set(key, [...(map.get(key) || []), song]);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [songs]);

  async function moveFavorite(song: MusicSong, direction: "up" | "down") {
    const index = favorites.findIndex((item) => item.id === song.id);
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (index < 0 || swapIndex < 0 || swapIndex >= favorites.length) return;
    const next = [...favorites];
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
    const order = next.map((item, idx) => ({ songId: item.id, favoriteId: item.favoriteId, order: idx + 1 }));
    setSongs((current) => current.map((item) => {
      const found = order.find((row) => row.songId === item.id);
      return found ? { ...item, favoriteOrder: found.order } : item;
    }));
    await fetch("/api/music/favorites/reorder", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order }) }).catch(() => null);
  }

  async function toggleFavorite(song: MusicSong) {
    const data = await fetch("/api/playlists/toggle-favorite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ songId: song.id, songSlug: song.slug }),
    }).then((res) => res.json()).catch(() => ({ ok: false }));
    if (data?.ok) await load();
  }

  function SongCard({ song, favoriteTools = false }: { song: MusicSong; favoriteTools?: boolean }) {
    return (
      <article className="music-app-song-card">
        <div className="music-app-cover">
          {song.coverUrl ? <img src={song.coverUrl} alt="" /> : <span>{song.title?.[0] || "♪"}</span>}
        </div>
        <div className="music-app-song-main">
          <div className="music-app-song-top">
            <div>
              <strong>{song.title}</strong>
              <small>{song.artist || "Caliph"} · {song.projectName || song.appSlug || "Caliphornia OS"}</small>
            </div>
            <span>{song.accessLabel}</span>
          </div>
          <div className="music-app-song-actions">
            <PlayButton songId={song.id} songSlug={song.slug} title={song.title} artist={song.artist} showShare={false} />
            <button className="music-mini-button" onClick={() => toggleFavorite(song)}>{song.favorite ? "Remove" : "Favorite"}</button>
            {song.shareable ? <ShareSongButton songId={song.id} songSlug={song.slug} title={song.title} /> : null}
            {favoriteTools ? <button className="music-mini-button" onClick={() => moveFavorite(song, "up")}>Move Up</button> : null}
            {favoriteTools ? <button className="music-mini-button" onClick={() => moveFavorite(song, "down")}>Move Down</button> : null}
          </div>
        </div>
      </article>
    );
  }

  return (
    <main className="music-app-page cos-uniform-page">
      <section className="music-app-shell cos-uniform-shell">
        <header className="music-app-hero">
          <div>
            <p>Caliphornia Music</p>
            <h1>Library</h1>
            <span>{email}</span>
          </div>
          <a href="/home">Home</a>
        </header>

        <section className="music-app-now-card">
          <div>
            <span>Central Music App</span>
            <strong>All songs, favorites, playlists, playback, and Share live here.</strong>
          </div>
          <div className="music-app-kpis">
            <div><span>Songs</span><strong>{songs.length}</strong></div>
            <div><span>Favorites</span><strong>{favorites.length}</strong></div>
            <div><span>Shareable</span><strong>{songs.filter((song) => song.shareable).length}</strong></div>
          </div>
        </section>

        <section className="music-app-controls">
          <div className="music-app-tabs">
            <button className={mode === "library" ? "active" : ""} onClick={() => setMode("library")}>Songs</button>
            <button className={mode === "favorites" ? "active" : ""} onClick={() => setMode("favorites")}>Favorites</button>
            <button className={mode === "projects" ? "active" : ""} onClick={() => setMode("projects")}>Projects</button>
            <button className={mode === "shared" ? "active" : ""} onClick={() => setMode("shared")}>Share</button>
          </div>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search songs, artists, projects" />
        </section>

        {status ? <div className="music-app-status">{status}</div> : null}
        {loading ? <div className="music-app-status">Loading your Music...</div> : null}

        {mode !== "projects" ? (
          <section className="music-app-list">
            {filtered.map((song) => <SongCard key={song.id} song={song} favoriteTools={mode === "favorites"} />)}
            {!loading && !filtered.length ? <div className="music-app-empty">No songs in this view yet.</div> : null}
          </section>
        ) : (
          <section className="music-app-projects">
            {projectGroups.map(([project, rows]) => (
              <details key={project} open className="music-app-project-group">
                <summary><strong>{project}</strong><span>{rows.length} songs</span></summary>
                <div className="music-app-list">{rows.map((song) => <SongCard key={song.id} song={song} />)}</div>
              </details>
            ))}
          </section>
        )}
      </section>
    </main>
  );
}
