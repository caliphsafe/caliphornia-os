"use client";

import Link from "next/link";
import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";

type AppOption = {
  id: string;
  slug: string;
  name: string;
};

type SongOption = {
  slug: string;
  title: string;
  app_slug: string | null;
};

type SongDetail = {
  song: {
    slug: string;
    title: string;
    artist_name: string | null;
    producer_names: string | null;
    audio_path: string | null;
    cover_image_path: string | null;
    track_number: number | null;
    duration_seconds: number | null;
    duration_label: string | null;
    display_date: string | null;
    description: string | null;
    is_featured: boolean | null;
    source_app_slug: string | null;
  };
  appSong: {
    position: number | null;
    app_slug: string | null;
  } | null;
  lyric: {
    body: string | null;
  } | null;
  conversation: {
    slug: string;
    title: string | null;
    subtitle: string | null;
    list_preview: string | null;
    avatar_letter: string | null;
    last_activity_label: string | null;
    sort_order: number | null;
  } | null;
};

type AppOrderRow = {
  song_slug: string;
  title: string;
  position: number | null;
};

type FormState = {
  appSlug: string;
  slug: string;
  title: string;
  artistName: string;
  producerNames: string;
  position: string;
  trackNumber: string;
  durationSeconds: string;
  durationLabel: string;
  displayDate: string;
  description: string;
  isFeatured: boolean;
  lyricsBody: string;
  useConversationBuilder: boolean;
};

function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "-");
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function titleFromFileName(fileName: string) {
  const noExt = fileName.replace(/\.[^/.]+$/, "");
  return noExt
    .replace(/[-_]+/g, " ")
    .replace(/\bfinal\b/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function formatDurationLabel(seconds: number) {
  const mm = Math.floor(seconds / 60);
  const ss = Math.round(seconds % 60);
  return `${mm}:${String(ss).padStart(2, "0")}`;
}

async function getAudioDuration(file: File): Promise<number> {
  return await new Promise((resolve, reject) => {
    const audio = document.createElement("audio");
    const objectUrl = URL.createObjectURL(file);
    audio.preload = "metadata";
    audio.src = objectUrl;

    audio.onloadedmetadata = () => {
      const duration = Number(audio.duration || 0);
      URL.revokeObjectURL(objectUrl);
      resolve(Number.isFinite(duration) ? Math.round(duration) : 0);
    };

    audio.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Could not read audio duration."));
    };
  });
}

async function createSignedUploadTarget(bucket: string, path: string, upsert = true) {
  const res = await fetch("/api/dashboard/storage-upload", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      bucket,
      path,
      upsert
    })
  });

  const data = await res.json();

  if (!data?.ok) {
    throw new Error(data?.error || "Could not create upload target.");
  }

  return data as {
    ok: true;
    bucket: string;
    path: string;
    token: string;
  };
}

async function uploadFileToSignedUrl(
  bucket: string,
  path: string,
  token: string,
  file: File
) {
  const { error } = await supabaseBrowser.storage
    .from(bucket)
    .uploadToSignedUrl(path, token, file, {
      contentType: file.type || undefined
    });

  if (error) {
    throw new Error(error.message);
  }
}

const EMPTY_FORM: FormState = {
  appSlug: "",
  slug: "",
  title: "",
  artistName: "",
  producerNames: "",
  position: "",
  trackNumber: "",
  durationSeconds: "",
  durationLabel: "",
  displayDate: "",
  description: "",
  isFeatured: false,
  lyricsBody: "",
  useConversationBuilder: false
};

export default function ImportSongPage() {
  const [mode, setMode] = useState<"new" | "edit">("new");
  const [apps, setApps] = useState<AppOption[]>([]);
  const [songs, setSongs] = useState<SongOption[]>([]);
  const [selectedSongSlug, setSelectedSongSlug] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState("");
  const [continueToFriendsBuilderSlug, setContinueToFriendsBuilderSlug] = useState("");
  const [audioFileName, setAudioFileName] = useState("");
  const [coverFileName, setCoverFileName] = useState("");
  const [coverPreviewUrl, setCoverPreviewUrl] = useState("");
  const [orderAppSlug, setOrderAppSlug] = useState("friends");
  const [orderRows, setOrderRows] = useState<AppOrderRow[]>([]);
  const [savingOrder, setSavingOrder] = useState(false);

  const audioInputRef = useRef<HTMLInputElement | null>(null);
  const coverInputRef = useRef<HTMLInputElement | null>(null);

  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const isFriends = form.appSlug === "friends";

  const selectedAppName = useMemo(() => {
    return apps.find((app) => app.slug === form.appSlug)?.name || form.appSlug || "App";
  }, [apps, form.appSlug]);

  useEffect(() => {
    return () => {
      if (coverPreviewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(coverPreviewUrl);
      }
    };
  }, [coverPreviewUrl]);

  async function loadAppsAndSongs() {
    const [appsRes, songsRes] = await Promise.all([
      fetch("/api/dashboard/import-song?mode=apps", { cache: "no-store" }),
      fetch("/api/dashboard/import-song?mode=songs", { cache: "no-store" })
    ]);

    const appsData = await appsRes.json();
    const songsData = await songsRes.json();

    if (appsData?.ok) {
      setApps(appsData.apps || []);
      setForm((prev) => ({
        ...prev,
        appSlug: prev.appSlug || appsData.apps?.[0]?.slug || ""
      }));
    }

    if (songsData?.ok) {
      setSongs(songsData.songs || []);
    }
  }

  async function loadAppOrder(appSlug: string) {
    const res = await fetch(
      `/api/dashboard/import-song?mode=app-order&appSlug=${encodeURIComponent(appSlug)}`,
      { cache: "no-store" }
    );
    const data = await res.json();

    if (data?.ok) {
      setOrderRows(data.rows || []);
    } else {
      setResult(data?.error || "Could not load app order.");
    }
  }

  useEffect(() => {
    async function boot() {
      try {
        await loadAppsAndSongs();
        await loadAppOrder("friends");
      } catch {
        setResult("Could not load admin data.");
      } finally {
        setLoading(false);
      }
    }

    boot();
  }, []);

  async function loadSongDetail(slug: string) {
    if (!slug) return;

    setResult("");
    setContinueToFriendsBuilderSlug("");

    try {
      const res = await fetch(
        `/api/dashboard/import-song?mode=song-detail&slug=${encodeURIComponent(slug)}`,
        { cache: "no-store" }
      );
      const data = await res.json();

      if (!data?.ok) {
        setResult(data?.error || "Could not load song.");
        return;
      }

      const detail = data.detail as SongDetail;

      setForm({
        appSlug: detail.appSong?.app_slug || detail.song.source_app_slug || apps[0]?.slug || "",
        slug: detail.song.slug || "",
        title: detail.song.title || "",
        artistName: detail.song.artist_name || "",
        producerNames: detail.song.producer_names || "",
        position: detail.appSong?.position != null ? String(detail.appSong.position) : "",
        trackNumber: detail.song.track_number != null ? String(detail.song.track_number) : "",
        durationSeconds:
          detail.song.duration_seconds != null ? String(detail.song.duration_seconds) : "",
        durationLabel: detail.song.duration_label || "",
        displayDate: detail.song.display_date || "",
        description: detail.song.description || "",
        isFeatured: Boolean(detail.song.is_featured),
        lyricsBody: detail.lyric?.body || "",
        useConversationBuilder: Boolean(detail.conversation)
      });

      setAudioFileName(detail.song.audio_path || "");
      setCoverFileName(detail.song.cover_image_path || "");
      setCoverPreviewUrl(detail.song.cover_image_path || "");
      setContinueToFriendsBuilderSlug(detail.conversation?.slug || "");
    } catch {
      setResult("Could not load song.");
    }
  }

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleAudioChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setAudioFileName(file.name);

    const inferredTitle = titleFromFileName(file.name);
    const inferredSlug = slugify(inferredTitle || file.name);

    let durationSeconds = 0;
    let durationLabel = "";

    try {
      durationSeconds = await getAudioDuration(file);
      durationLabel = formatDurationLabel(durationSeconds);
    } catch {}

    setForm((prev) => ({
      ...prev,
      title: mode === "new" && !prev.title ? inferredTitle : prev.title,
      slug: mode === "new" && !prev.slug ? inferredSlug : prev.slug,
      durationSeconds:
        mode === "new" && !prev.durationSeconds && durationSeconds
          ? String(durationSeconds)
          : prev.durationSeconds,
      durationLabel:
        mode === "new" && !prev.durationLabel && durationLabel ? durationLabel : prev.durationLabel
    }));
  }

  function handleCoverChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setCoverFileName(file.name);

    if (coverPreviewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(coverPreviewUrl);
    }

    setCoverPreviewUrl(URL.createObjectURL(file));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setResult("");
    setContinueToFriendsBuilderSlug("");

    try {
      const songSlug = form.slug.trim();
      const appSlug = form.appSlug.trim();

      if (!songSlug || !appSlug || !form.title.trim() || !form.artistName.trim()) {
        setResult("Missing required fields.");
        setSaving(false);
        return;
      }

      const audioFile = audioInputRef.current?.files?.[0] || null;
      const coverFile = coverInputRef.current?.files?.[0] || null;

      let audioPath = audioFileName && audioFileName.includes("/") ? audioFileName : "";
      let coverImagePath = coverFileName && coverFileName.includes("/") ? coverFileName : "";

      if (audioFile) {
        const audioExt = (audioFile.name.split(".").pop() || "mp3").toLowerCase();
        audioPath = `${appSlug}/${songSlug}/${songSlug}-final.${safeFileName(audioExt)}`;

        const audioTarget = await createSignedUploadTarget("songs", audioPath, true);
        await uploadFileToSignedUrl("songs", audioTarget.path, audioTarget.token, audioFile);
        setAudioFileName(audioPath);
      }

      if (coverFile) {
        const coverExt = (coverFile.name.split(".").pop() || "png").toLowerCase();
        coverImagePath = `${appSlug}/${songSlug}/${songSlug}.${safeFileName(coverExt)}`;

        const coverTarget = await createSignedUploadTarget("cover-art", coverImagePath, true);
        await uploadFileToSignedUrl("cover-art", coverTarget.path, coverTarget.token, coverFile);
        setCoverFileName(coverImagePath);
      }

      const payload = new FormData();

      payload.append("mode", mode);
      payload.append("selectedSongSlug", selectedSongSlug);
      payload.append("appSlug", form.appSlug);
      payload.append("slug", form.slug.trim());
      payload.append("title", form.title.trim());
      payload.append("artistName", form.artistName.trim());
      payload.append("producerNames", form.producerNames.trim());
      payload.append("position", form.position.trim());
      payload.append("trackNumber", form.trackNumber.trim());
      payload.append("durationSeconds", form.durationSeconds.trim());
      payload.append("durationLabel", form.durationLabel.trim());
      payload.append("displayDate", form.displayDate.trim());
      payload.append("description", form.description.trim());
      payload.append("isFeatured", String(form.isFeatured));
      payload.append("lyricsBody", form.lyricsBody);
      payload.append("audioPath", audioPath);
      payload.append("coverImagePath", coverImagePath);

      const res = await fetch("/api/dashboard/import-song", {
        method: "POST",
        body: payload
      });

      const data = await res.json();

      if (!data?.ok) {
        setResult(data?.error || "Could not save.");
        return;
      }

      setResult(`Saved "${data.song?.title}".`);

      if (isFriends && form.useConversationBuilder) {
        setContinueToFriendsBuilderSlug(form.slug.trim() || data.song?.slug || "");
      }

      await loadAppsAndSongs();
      await loadAppOrder(orderAppSlug);

      if (mode === "new") {
        setForm((prev) => ({
          ...EMPTY_FORM,
          appSlug: prev.appSlug
        }));
        setAudioFileName("");
        setCoverFileName("");
        setCoverPreviewUrl("");
        if (audioInputRef.current) audioInputRef.current.value = "";
        if (coverInputRef.current) coverInputRef.current.value = "";
      }
    } catch (error: any) {
      setResult(error?.message || "Server error while saving.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveOrder() {
    setSavingOrder(true);
    setResult("");

    try {
      const res = await fetch("/api/dashboard/import-song", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save-order",
          appSlug: orderAppSlug,
          rows: orderRows.map((row) => ({
            songSlug: row.song_slug,
            position: row.position
          }))
        })
      });

      const data = await res.json();

      if (!data?.ok) {
        setResult(data?.error || "Could not save order.");
        setSavingOrder(false);
        return;
      }

      setResult(`Saved ${orderAppSlug} order.`);
      await loadAppOrder(orderAppSlug);
    } catch {
      setResult("Server error while saving order.");
    } finally {
      setSavingOrder(false);
    }
  }

  return (
    <main className="manager-wrap">
      <div className="manager-hero">
        <div>
          <p className="manager-kicker">Caliphornia OS</p>
          <h1>Song Manager</h1>
          <p className="manager-copy">
            Upload songs, covers, metadata, lyrics, app placement, and route Friends songs straight into the conversation builder.
          </p>
        </div>

        <div className="manager-hero-actions">
          <Link href="/dashboard" className="ghost-link">
            Back to Dashboard
          </Link>

          <button
            type="button"
            className={`ghost-btn ${mode === "new" ? "is-active" : ""}`}
            onClick={() => {
              setMode("new");
              setSelectedSongSlug("");
              setForm((prev) => ({
                ...EMPTY_FORM,
                appSlug: prev.appSlug || apps[0]?.slug || ""
              }));
              setAudioFileName("");
              setCoverFileName("");
              setCoverPreviewUrl("");
              setContinueToFriendsBuilderSlug("");
              setResult("");
            }}
          >
            New Song
          </button>

          <button
            type="button"
            className={`ghost-btn ${mode === "edit" ? "is-active" : ""}`}
            onClick={() => setMode("edit")}
          >
            Edit Existing
          </button>
        </div>
      </div>

      {loading ? (
        <p className="muted">Loading…</p>
      ) : (
        <div className="manager-grid">
          <div className="manager-form-column">
            {mode === "edit" ? (
              <section className="panel">
                <h2>Load Existing Song</h2>

                <label className="field">
                  <span>Select Song</span>
                  <select
                    value={selectedSongSlug}
                    onChange={(e) => {
                      const slug = e.target.value;
                      setSelectedSongSlug(slug);
                      if (slug) loadSongDetail(slug);
                    }}
                  >
                    <option value="">Choose a song</option>
                    {songs.map((song) => (
                      <option key={song.slug} value={song.slug}>
                        {song.title} ({song.slug}) {song.app_slug ? `• ${song.app_slug}` : ""}
                      </option>
                    ))}
                  </select>
                </label>
              </section>
            ) : null}

            <form onSubmit={handleSubmit} className="manager-form">
              <section className="panel">
                <div className="section-head">
                  <div>
                    <h2>Song Details</h2>
                    <p className="muted">
                      The core song info used across your app ecosystem.
                    </p>
                  </div>
                </div>

                <div className="grid-two">
                  <label className="field">
                    <span>App</span>
                    <select
                      value={form.appSlug}
                      onChange={(e) => updateField("appSlug", e.target.value)}
                      required
                    >
                      {apps.map((app) => (
                        <option key={app.id} value={app.slug}>
                          {app.name} ({app.slug})
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="field">
                    <span>Song Slug</span>
                    <input
                      value={form.slug}
                      onChange={(e) => updateField("slug", slugify(e.target.value))}
                      placeholder="e.g. walking-brick"
                      required
                    />
                  </label>
                </div>

                <div className="grid-two">
                  <label className="field">
                    <span>Title</span>
                    <input
                      value={form.title}
                      onChange={(e) => updateField("title", e.target.value)}
                      placeholder="Song title"
                      required
                    />
                  </label>

                  <label className="field">
                    <span>Artist Name(s)</span>
                    <input
                      value={form.artistName}
                      onChange={(e) => updateField("artistName", e.target.value)}
                      placeholder="e.g. Caliph, SiahLaw, Resto"
                      required
                    />
                  </label>
                </div>

                <label className="field">
                  <span>Producer Name(s)</span>
                  <input
                    value={form.producerNames}
                    onChange={(e) => updateField("producerNames", e.target.value)}
                    placeholder="e.g. Caliph, AyyDot"
                  />
                </label>

                <label className="field">
                  <span>Description</span>
                  <textarea
                    value={form.description}
                    onChange={(e) => updateField("description", e.target.value)}
                    rows={4}
                    placeholder="Short description shown in the app"
                  />
                </label>
              </section>

              <section className="panel">
                <div className="section-head">
                  <div>
                    <h2>Media</h2>
                    <p className="muted">
                      Audio auto-detects duration and can auto-fill title/slug on new songs.
                    </p>
                  </div>
                </div>

                <div className="grid-two">
                  <label className="field">
                    <span>Audio File {mode === "edit" ? "(optional to replace)" : ""}</span>
                    <input
                      ref={audioInputRef}
                      type="file"
                      accept="audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/mp4,audio/aac"
                      onChange={handleAudioChange}
                      required={mode === "new"}
                    />
                    {audioFileName ? <div className="file-meta">{audioFileName}</div> : null}
                  </label>

                  <label className="field">
                    <span>Cover File {mode === "edit" ? "(optional to replace)" : "(optional)"}</span>
                    <input
                      ref={coverInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={handleCoverChange}
                    />
                    {coverFileName ? <div className="file-meta">{coverFileName}</div> : null}
                  </label>
                </div>

                <div className="grid-three">
                  <label className="field">
                    <span>Duration Seconds</span>
                    <input
                      value={form.durationSeconds}
                      onChange={(e) => updateField("durationSeconds", e.target.value)}
                      type="number"
                      placeholder="127"
                    />
                  </label>

                  <label className="field">
                    <span>Duration Label</span>
                    <input
                      value={form.durationLabel}
                      onChange={(e) => updateField("durationLabel", e.target.value)}
                      placeholder="2:07"
                    />
                  </label>

                  <label className="field">
                    <span>Display Date</span>
                    <input
                      value={form.displayDate}
                      onChange={(e) => updateField("displayDate", e.target.value)}
                      placeholder="May 14, 2026"
                    />
                  </label>
                </div>
              </section>

              <section className="panel">
                <div className="section-head">
                  <div>
                    <h2>Placement</h2>
                    <p className="muted">
                      Control how the song sits inside the selected app.
                    </p>
                  </div>
                </div>

                <div className="grid-two">
                  <label className="field">
                    <span>App Position</span>
                    <input
                      value={form.position}
                      onChange={(e) => updateField("position", e.target.value)}
                      type="number"
                      placeholder="1"
                    />
                  </label>

                  <label className="field">
                    <span>Track Number</span>
                    <input
                      value={form.trackNumber}
                      onChange={(e) => updateField("trackNumber", e.target.value)}
                      type="number"
                      placeholder="1"
                    />
                  </label>
                </div>

                <label className="check-row">
                  <input
                    type="checkbox"
                    checked={form.isFeatured}
                    onChange={(e) => updateField("isFeatured", e.target.checked)}
                  />
                  <span>Featured song</span>
                </label>
              </section>

              <section className="panel">
                <div className="section-head">
                  <div>
                    <h2>Lyrics</h2>
                    <p className="muted">
                      Primary lyric body for the song. Leave blank if not ready yet.
                    </p>
                  </div>
                </div>

                <label className="field">
                  <span>Lyrics</span>
                  <textarea
                    value={form.lyricsBody}
                    onChange={(e) => updateField("lyricsBody", e.target.value)}
                    rows={12}
                    placeholder="Paste lyrics here"
                  />
                </label>
              </section>

              {isFriends ? (
                <section className="panel">
                  <div className="section-head">
                    <div>
                      <h2>Fri.ends Handoff</h2>
                      <p className="muted">
                        Route this song into the conversation builder after saving.
                      </p>
                    </div>
                  </div>

                  <label className="check-row">
                    <input
                      type="checkbox"
                      checked={form.useConversationBuilder}
                      onChange={(e) => updateField("useConversationBuilder", e.target.checked)}
                    />
                    <span>Use Conversation Builder after saving</span>
                  </label>
                </section>
              ) : null}

              <button type="submit" disabled={saving} className="save-btn">
                {saving ? "Saving..." : mode === "new" ? "Create Song" : "Save Changes"}
              </button>
            </form>

            {continueToFriendsBuilderSlug ? (
              <section className="panel handoff-panel">
                <h2>Continue to Fri.ends Builder</h2>
                <p className="muted">
                  Song saved. You can now build the conversation around how it came together.
                </p>

                <a
                  href={`/dashboard/friends-builder?song=${encodeURIComponent(
                    continueToFriendsBuilderSlug
                  )}`}
                  className="ghost-link"
                >
                  Continue to Fri.ends Builder
                </a>
              </section>
            ) : null}

            <section className="panel">
              <div className="section-head">
                <div>
                  <h2>App Order Manager</h2>
                  <p className="muted">
                    Reorder songs inside each app without leaving the Song Manager.
                  </p>
                </div>
              </div>

              <div className="order-topbar">
                <select
                  value={orderAppSlug}
                  onChange={async (e) => {
                    const next = e.target.value;
                    setOrderAppSlug(next);
                    await loadAppOrder(next);
                  }}
                >
                  {apps.map((app) => (
                    <option key={app.id} value={app.slug}>
                      {app.name} ({app.slug})
                    </option>
                  ))}
                </select>

                <button type="button" className="ghost-btn" onClick={handleSaveOrder} disabled={savingOrder}>
                  {savingOrder ? "Saving..." : "Save Order"}
                </button>
              </div>

              <div className="order-list">
                {orderRows.map((row) => (
                  <div key={row.song_slug} className="order-row">
                    <div className="order-copy">
                      <div className="order-title">{row.title}</div>
                      <div className="order-slug">{row.song_slug}</div>
                    </div>

                    <input
                      type="number"
                      value={row.position ?? ""}
                      onChange={(e) =>
                        setOrderRows((prev) =>
                          prev.map((r) =>
                            r.song_slug === row.song_slug
                              ? {
                                  ...r,
                                  position: e.target.value ? Number(e.target.value) : null
                                }
                              : r
                          )
                        )
                      }
                    />
                  </div>
                ))}
              </div>
            </section>

            {result ? <p className="save-result">{result}</p> : null}
          </div>

          <aside className="preview-column">
            <section className="preview-panel">
              <div className="preview-card">
                <div className="preview-cover">
                  {coverPreviewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={coverPreviewUrl} alt={form.title || "Cover art"} />
                  ) : (
                    <div className="preview-cover-fallback">
                      <span>{(form.title || "Song").slice(0, 1).toUpperCase()}</span>
                    </div>
                  )}
                </div>

                <div className="preview-meta">
                  <div className="preview-badge">{selectedAppName}</div>
                  <h3>{form.title || "Untitled Song"}</h3>
                  <p className="preview-artist">{form.artistName || "Artist name"}</p>
                  <p className="preview-description">
                    {form.description || "Description preview will appear here."}
                  </p>

                  <div className="preview-stats">
                    <div>
                      <span>Slug</span>
                      <strong>{form.slug || "song-slug"}</strong>
                    </div>
                    <div>
                      <span>Duration</span>
                      <strong>{form.durationLabel || "0:00"}</strong>
                    </div>
                    <div>
                      <span>Track</span>
                      <strong>{form.trackNumber || "—"}</strong>
                    </div>
                    <div>
                      <span>Position</span>
                      <strong>{form.position || "—"}</strong>
                    </div>
                  </div>

                  {form.producerNames ? (
                    <div className="preview-line">
                      <span>Producers</span>
                      <strong>{form.producerNames}</strong>
                    </div>
                  ) : null}

                  {form.isFeatured ? <div className="preview-featured">Featured</div> : null}
                </div>
              </div>
            </section>
          </aside>
        </div>
      )}

      
    </main>
  );
}
