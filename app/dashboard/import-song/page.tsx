"use client";

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
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

  const [orderAppSlug, setOrderAppSlug] = useState("friends");
  const [orderRows, setOrderRows] = useState<AppOrderRow[]>([]);
  const [savingOrder, setSavingOrder] = useState(false);

  const audioInputRef = useRef<HTMLInputElement | null>(null);
  const coverInputRef = useRef<HTMLInputElement | null>(null);

  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const isFriends = form.appSlug === "friends";

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
    <main style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ marginBottom: 8 }}>Song Manager</h1>
        <p style={{ margin: 0, opacity: 0.75 }}>
          Upload songs, edit metadata and lyrics, assign songs to apps, and manage app order.
        </p>
      </div>

      {loading ? (
        <p>Loading…</p>
      ) : (
        <>
          <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
            <button
              type="button"
              onClick={() => {
                setMode("new");
                setSelectedSongSlug("");
                setForm((prev) => ({
                  ...EMPTY_FORM,
                  appSlug: prev.appSlug || apps[0]?.slug || ""
                }));
                setAudioFileName("");
                setCoverFileName("");
                setContinueToFriendsBuilderSlug("");
                setResult("");
              }}
              style={{ padding: "10px 14px", borderRadius: 10 }}
            >
              New Song
            </button>
            <button
              type="button"
              onClick={() => setMode("edit")}
              style={{ padding: "10px 14px", borderRadius: 10 }}
            >
              Edit Existing
            </button>
          </div>

          {mode === "edit" ? (
            <div style={{ marginBottom: 20 }}>
              <label>
                <div>Select Song</div>
                <select
                  value={selectedSongSlug}
                  onChange={(e) => {
                    const slug = e.target.value;
                    setSelectedSongSlug(slug);
                    if (slug) loadSongDetail(slug);
                  }}
                  style={{ width: "100%", padding: 12 }}
                >
                  <option value="">Choose a song</option>
                  {songs.map((song) => (
                    <option key={song.slug} value={song.slug}>
                      {song.title} ({song.slug}) {song.app_slug ? `• ${song.app_slug}` : ""}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : null}

          <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16 }}>
            <section
              style={{
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 16,
                padding: 16
              }}
            >
              <h2 style={{ marginTop: 0 }}>Song</h2>

              <label>
                <div>App</div>
                <select
                  value={form.appSlug}
                  onChange={(e) => updateField("appSlug", e.target.value)}
                  required
                  style={{ width: "100%", padding: 12 }}
                >
                  {apps.map((app) => (
                    <option key={app.id} value={app.slug}>
                      {app.name} ({app.slug})
                    </option>
                  ))}
                </select>
              </label>

              <div style={{ marginTop: 16 }}>
                <label>
                  <div>Audio File {mode === "new" ? "" : "(optional to replace)"}</div>
                  <input
                    ref={audioInputRef}
                    type="file"
                    accept="audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/mp4,audio/aac"
                    onChange={handleAudioChange}
                    required={mode === "new"}
                  />
                  {audioFileName ? (
                    <div style={{ marginTop: 6, opacity: 0.7 }}>{audioFileName}</div>
                  ) : null}
                </label>
              </div>

              <div style={{ marginTop: 16 }}>
                <label>
                  <div>Cover File {mode === "edit" ? "(optional to replace)" : "(optional)"}</div>
                  <input
                    ref={coverInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleCoverChange}
                  />
                  {coverFileName ? (
                    <div style={{ marginTop: 6, opacity: 0.7 }}>{coverFileName}</div>
                  ) : null}
                </label>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 16,
                  marginTop: 16
                }}
              >
                <label>
                  <div>Song Slug</div>
                  <input
                    value={form.slug}
                    onChange={(e) => updateField("slug", slugify(e.target.value))}
                    required
                    style={{ width: "100%", padding: 12 }}
                  />
                </label>

                <label>
                  <div>Title</div>
                  <input
                    value={form.title}
                    onChange={(e) => updateField("title", e.target.value)}
                    required
                    style={{ width: "100%", padding: 12 }}
                  />
                </label>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 16,
                  marginTop: 16
                }}
              >
                <label>
                  <div>Artist Name</div>
                  <input
                    value={form.artistName}
                    onChange={(e) => updateField("artistName", e.target.value)}
                    required
                    style={{ width: "100%", padding: 12 }}
                  />
                </label>

                <label>
                  <div>Producer Names</div>
                  <input
                    value={form.producerNames}
                    onChange={(e) => updateField("producerNames", e.target.value)}
                    style={{ width: "100%", padding: 12 }}
                  />
                </label>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 16,
                  marginTop: 16
                }}
              >
                <label>
                  <div>App Position</div>
                  <input
                    value={form.position}
                    onChange={(e) => updateField("position", e.target.value)}
                    type="number"
                    style={{ width: "100%", padding: 12 }}
                  />
                </label>

                <label>
                  <div>Track Number</div>
                  <input
                    value={form.trackNumber}
                    onChange={(e) => updateField("trackNumber", e.target.value)}
                    type="number"
                    style={{ width: "100%", padding: 12 }}
                  />
                </label>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: 16,
                  marginTop: 16
                }}
              >
                <label>
                  <div>Duration Seconds</div>
                  <input
                    value={form.durationSeconds}
                    onChange={(e) => updateField("durationSeconds", e.target.value)}
                    type="number"
                    style={{ width: "100%", padding: 12 }}
                  />
                </label>

                <label>
                  <div>Duration Label</div>
                  <input
                    value={form.durationLabel}
                    onChange={(e) => updateField("durationLabel", e.target.value)}
                    style={{ width: "100%", padding: 12 }}
                  />
                </label>

                <label>
                  <div>Display Date</div>
                  <input
                    value={form.displayDate}
                    onChange={(e) => updateField("displayDate", e.target.value)}
                    style={{ width: "100%", padding: 12 }}
                  />
                </label>
              </div>

              <div style={{ marginTop: 16 }}>
                <label>
                  <div>Description</div>
                  <textarea
                    value={form.description}
                    onChange={(e) => updateField("description", e.target.value)}
                    rows={3}
                    style={{ width: "100%", padding: 12 }}
                  />
                </label>
              </div>

              <div style={{ marginTop: 16 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <input
                    type="checkbox"
                    checked={form.isFeatured}
                    onChange={(e) => updateField("isFeatured", e.target.checked)}
                  />
                  Featured song
                </label>
              </div>

              <div style={{ marginTop: 16 }}>
                <label>
                  <div>Lyrics (optional)</div>
                  <textarea
                    value={form.lyricsBody}
                    onChange={(e) => updateField("lyricsBody", e.target.value)}
                    rows={10}
                    style={{ width: "100%", padding: 12 }}
                  />
                </label>
              </div>

              {isFriends ? (
                <div style={{ marginTop: 20 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <input
                      type="checkbox"
                      checked={form.useConversationBuilder}
                      onChange={(e) =>
                        updateField("useConversationBuilder", e.target.checked)
                      }
                    />
                    Use Conversation Builder after saving
                  </label>
                </div>
              ) : null}
            </section>

            <button type="submit" disabled={saving} style={{ padding: 14, borderRadius: 12 }}>
              {saving ? "Saving..." : mode === "new" ? "Create Song" : "Save Changes"}
            </button>
          </form>

          {continueToFriendsBuilderSlug ? (
            <div
              style={{
                marginTop: 16,
                padding: 16,
                borderRadius: 16,
                border: "1px solid rgba(255,255,255,0.12)"
              }}
            >
              <p style={{ marginTop: 0 }}>
                Song saved. Continue to the Fri.ends builder for the full conversation setup.
              </p>
             <a
  href={`/dashboard/friends-builder?song=${encodeURIComponent(
    continueToFriendsBuilderSlug
  )}`}
  style={{
    display: "inline-block",
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.12)",
    textDecoration: "none",
    color: "inherit"
  }}
>
  Continue to Fri.ends Builder
</a>
            </div>
          ) : null}

          <section
            style={{
              marginTop: 32,
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 16,
              padding: 16
            }}
          >
            <h2 style={{ marginTop: 0 }}>App Order Manager</h2>

            <div
              style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16 }}
            >
              <select
                value={orderAppSlug}
                onChange={async (e) => {
                  const next = e.target.value;
                  setOrderAppSlug(next);
                  await loadAppOrder(next);
                }}
                style={{ padding: 10 }}
              >
                {apps.map((app) => (
                  <option key={app.id} value={app.slug}>
                    {app.name} ({app.slug})
                  </option>
                ))}
              </select>

              <button type="button" onClick={handleSaveOrder} disabled={savingOrder}>
                {savingOrder ? "Saving..." : "Save Order"}
              </button>
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              {orderRows.map((row) => (
                <div
                  key={row.song_slug}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 140px",
                    gap: 12,
                    alignItems: "center"
                  }}
                >
                  <div>
                    {row.title}{" "}
                    <span style={{ opacity: 0.6 }}>({row.song_slug})</span>
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
                    style={{ width: "100%", padding: 10 }}
                  />
                </div>
              ))}
            </div>
          </section>

          {result ? <p style={{ marginTop: 20 }}>{result}</p> : null}
        </>
      )}
    </main>
  );
}
