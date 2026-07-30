"use client";

import { useMemo, useState } from "react";

type Song = { id: string; slug: string; title?: string | null; artist_name?: string | null; source_app_slug?: string | null; project_id?: string | null; status?: string | null; is_shareable?: boolean | null; is_locked?: boolean | null; requires_project_access?: boolean | null; audio_path?: string | null; preview_audio_path?: string | null; position?: number | null };
type Project = { id: string; slug: string; name?: string | null; title?: string | null };
type App = { id: string; slug: string; name?: string | null; title?: string | null };

export default function AdminMusicClient({ songs, projects, apps }: { songs: Song[]; projects: Project[]; apps: App[] }) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(songs[0]?.id || "");
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    title: songs[0]?.title || "",
    artistName: songs[0]?.artist_name || "Caliph",
    slug: songs[0]?.slug || "",
    audioPath: songs[0]?.audio_path || "",
    previewPath: songs[0]?.preview_audio_path || "",
    status: songs[0]?.status || "active",
    projectId: songs[0]?.project_id || projects[0]?.id || "",
    appSlug: songs[0]?.source_app_slug || apps[0]?.slug || "music",
    isShareable: songs[0]?.is_shareable !== false,
    isLocked: Boolean(songs[0]?.is_locked),
    requiresProjectAccess: Boolean(songs[0]?.requires_project_access),
  });

  const selected = songs.find((song) => song.id === selectedId) || songs[0] || null;
  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return songs.filter((song) => !q || `${song.title} ${song.slug} ${song.artist_name} ${song.source_app_slug}`.toLowerCase().includes(q));
  }, [songs, query]);

  function loadSong(song: Song) {
    setSelectedId(song.id);
    setForm({
      title: song.title || "",
      artistName: song.artist_name || "Caliph",
      slug: song.slug || "",
      audioPath: song.audio_path || "",
      previewPath: song.preview_audio_path || "",
      status: song.status || "active",
      projectId: song.project_id || projects[0]?.id || "",
      appSlug: song.source_app_slug || apps[0]?.slug || "music",
      isShareable: song.is_shareable !== false,
      isLocked: Boolean(song.is_locked),
      requiresProjectAccess: Boolean(song.requires_project_access),
    });
  }

  function update(name: string, value: string | boolean) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function save(action: "update_song" | "create_song") {
    setMessage("");
    const result = await fetch("/api/admin/music", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, songId: selected?.id, ...form }),
    }).then((res) => res.json()).catch(() => ({ ok: false, error: "Could not save song." }));
    setMessage(result.ok ? result.message || "Saved." : result.error || "Could not save.");
  }

  return (
    <main className="admin-os-page">
      <section className="admin-os-shell">
        <header className="admin-os-topbar">
          <a href="/dashboard" className="admin-os-pill">‹ Dashboard</a>
          <a href="/apps/music" className="admin-os-pill">Open Music</a>
        </header>

        <section className="admin-os-hero">
          <div>
            <p>Music Admin</p>
            <h1>Songs + Experiences</h1>
            <span>Update audio paths, project mapping, app surface, lock state, shareability, and publishing status.</span>
          </div>
          <div className="admin-os-gear">♪</div>
        </section>

        {message ? <section className="admin-form-card"><strong>{message}</strong></section> : null}

        <section className="admin-control-grid">
          <aside className="admin-control-card">
            <h2>Songs</h2>
            <input className="admin-input" placeholder="Search songs" value={query} onChange={(event) => setQuery(event.target.value)} />
            <div className="admin-list">
              {filtered.map((song) => (
                <button className="admin-row-card" key={song.id} onClick={() => loadSong(song)}>
                  <span>
                    <strong>{song.title || song.slug}</strong>
                    <small>{song.artist_name || "Caliph"} · {song.source_app_slug || "music"}</small>
                  </span>
                  <span className="admin-role-pill">{song.is_shareable === false ? "No Share" : "Share"}</span>
                </button>
              ))}
            </div>
          </aside>

          <section className="admin-form-card">
            <h2>{selected ? `Edit ${selected.title || selected.slug}` : "Create song"}</h2>
            <input className="admin-input" placeholder="Title" value={form.title} onChange={(event) => update("title", event.target.value)} />
            <input className="admin-input" placeholder="Slug" value={form.slug} onChange={(event) => update("slug", event.target.value)} />
            <input className="admin-input" placeholder="Artist" value={form.artistName} onChange={(event) => update("artistName", event.target.value)} />
            <input className="admin-input" placeholder="Audio path, for example fartherhood/storytime.mp3" value={form.audioPath} onChange={(event) => update("audioPath", event.target.value)} />
            <input className="admin-input" placeholder="Preview audio path, optional" value={form.previewPath} onChange={(event) => update("previewPath", event.target.value)} />
            <select className="admin-select" value={form.status} onChange={(event) => update("status", event.target.value)}>
              <option value="active">Active</option>
              <option value="draft">Draft</option>
              <option value="hidden">Hidden</option>
              <option value="archived">Archived</option>
            </select>
            <select className="admin-select" value={form.projectId} onChange={(event) => update("projectId", event.target.value)}>
              {projects.map((project) => <option key={project.id} value={project.id}>{project.name || project.title || project.slug}</option>)}
            </select>
            <select className="admin-select" value={form.appSlug} onChange={(event) => update("appSlug", event.target.value)}>
              {apps.map((app) => <option key={app.id} value={app.slug}>{app.name || app.title || app.slug}</option>)}
              <option value="music">Music</option>
              <option value="fartherhood">FarTHErHOOD</option>
              <option value="friends">Fri.ends</option>
              <option value="milia">Milia</option>
            </select>
            <label><input type="checkbox" checked={form.isShareable} onChange={(event) => update("isShareable", event.target.checked)} /> Shareable</label>
            <label><input type="checkbox" checked={form.isLocked} onChange={(event) => update("isLocked", event.target.checked)} /> Locked</label>
            <label><input type="checkbox" checked={form.requiresProjectAccess} onChange={(event) => update("requiresProjectAccess", event.target.checked)} /> Requires project access</label>
            <div className="admin-button-row">
              <button className="admin-btn" onClick={() => save("update_song")}>Save Song</button>
              <button className="admin-btn secondary" onClick={() => save("create_song")}>Create As New</button>
            </div>
          </section>
        </section>
      </section>
    </main>
  );
}
