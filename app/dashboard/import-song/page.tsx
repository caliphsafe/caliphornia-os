"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";

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
  createConversation: boolean;
  conversationSlug: string;
  conversationTitle: string;
  conversationSubtitle: string;
  listPreview: string;
  avatarLetter: string;
  lastActivityLabel: string;
  sortOrder: string;
};

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
  createConversation: false,
  conversationSlug: "",
  conversationTitle: "",
  conversationSubtitle: "",
  listPreview: "",
  avatarLetter: "",
  lastActivityLabel: "",
  sortOrder: ""
};

export default function ImportSongPage() {
  const [mode, setMode] = useState<"new" | "edit">("new");
  const [apps, setApps] = useState<AppOption[]>([]);
  const [songs, setSongs] = useState<SongOption[]>([]);
  const [selectedSongSlug, setSelectedSongSlug] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState("");
  const [audioFileName, setAudioFileName] = useState("");
  const [coverFileName, setCoverFileName] = useState("");

  const audioInputRef = useRef<HTMLInputElement | null>(null);
  const coverInputRef = useRef<HTMLInputElement | null>(null);

  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const isFriends = form.appSlug === "friends";

  useEffect(() => {
    async function boot() {
      try {
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
        createConversation: Boolean(detail.conversation),
        conversationSlug: detail.conversation?.slug || "",
        conversationTitle: detail.conversation?.title || "",
        conversationSubtitle: detail.conversation?.subtitle || "",
        listPreview: detail.conversation?.list_preview || "",
        avatarLetter: detail.conversation?.avatar_letter || "",
        lastActivityLabel: detail.conversation?.last_activity_label || "",
        sortOrder:
          detail.conversation?.sort_order != null ? String(detail.conversation.sort_order) : ""
      });

      setAudioFileName(detail.song.audio_path || "");
      setCoverFileName(detail.song.cover_image_path || "");
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
        mode === "new" && !prev.durationLabel && durationLabel ? durationLabel : prev.durationLabel,
      conversationSlug:
        mode === "new" && prev.appSlug === "friends" && !prev.conversationSlug
          ? inferredSlug
          : prev.conversationSlug,
      conversationTitle:
        mode === "new" && prev.appSlug === "friends" && !prev.conversationTitle
          ? inferredTitle
          : prev.conversationTitle,
      avatarLetter:
        mode === "new" && prev.appSlug === "friends" && !prev.avatarLetter && inferredTitle
          ? inferredTitle[0].toUpperCase()
          : prev.avatarLetter
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

    try {
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
      payload.append("createConversation", String(form.createConversation));
      payload.append("conversationSlug", form.conversationSlug.trim());
      payload.append("conversationTitle", form.conversationTitle.trim());
      payload.append("conversationSubtitle", form.conversationSubtitle.trim());
      payload.append("listPreview", form.listPreview.trim());
      payload.append("avatarLetter", form.avatarLetter.trim());
      payload.append("lastActivityLabel", form.lastActivityLabel.trim());
      payload.append("sortOrder", form.sortOrder.trim());

      const audioFile = audioInputRef.current?.files?.[0];
      const coverFile = coverInputRef.current?.files?.[0];

      if (audioFile) payload.append("audioFile", audioFile);
      if (coverFile) payload.append("coverFile", coverFile);

      const res = await fetch("/api/dashboard/import-song", {
        method: "POST",
        body: payload
      });

      const data = await res.json();

      if (!data?.ok) {
        setResult(data?.error || "Could not save.");
        return;
      }

      setResult(
        data?.conversation
          ? `Saved "${data.song?.title}" and updated conversation "${data.conversation?.title}".`
          : `Saved "${data.song?.title}".`
      );

      const songsRes = await fetch("/api/dashboard/import-song?mode=songs", {
        cache: "no-store"
      });
      const songsData = await songsRes.json();
      if (songsData?.ok) {
        setSongs(songsData.songs || []);
      }

      if (mode === "new") {
        setForm((prev) => ({ ...EMPTY_FORM, appSlug: prev.appSlug }));
        setAudioFileName("");
        setCoverFileName("");
        if (audioInputRef.current) audioInputRef.current.value = "";
        if (coverInputRef.current) coverInputRef.current.value = "";
      }
    } catch {
      setResult("Server error while saving.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main style={{ padding: 24, maxWidth: 820, margin: "0 auto" }}>
      <h1 style={{ marginBottom: 8 }}>Song Manager</h1>
      <p style={{ marginTop: 0, marginBottom: 24, opacity: 0.75 }}>
        Create new songs, edit existing songs, and optionally create or update a Fri.ends conversation.
      </p>

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
                setForm((prev) => ({ ...EMPTY_FORM, appSlug: prev.appSlug || apps[0]?.slug || "" }));
                setAudioFileName("");
                setCoverFileName("");
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

            <label>
              <div>Audio File {mode === "new" ? "" : "(optional to replace)"}</div>
              <input
                ref={audioInputRef}
                type="file"
                accept="audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/mp4,audio/aac"
                onChange={handleAudioChange}
                required={mode === "new"}
              />
              {audioFileName ? <div style={{ marginTop: 6, opacity: 0.7 }}>{audioFileName}</div> : null}
            </label>

            <label>
              <div>Cover File {mode === "edit" ? "(optional to replace)" : "(optional)"}</div>
              <input
                ref={coverInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleCoverChange}
              />
              {coverFileName ? <div style={{ marginTop: 6, opacity: 0.7 }}>{coverFileName}</div> : null}
            </label>

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

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
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

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
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
            </div>

            <label>
              <div>Display Date</div>
              <input
                value={form.displayDate}
                onChange={(e) => updateField("displayDate", e.target.value)}
                style={{ width: "100%", padding: 12 }}
              />
            </label>

            <label>
              <div>Description</div>
              <textarea
                value={form.description}
                onChange={(e) => updateField("description", e.target.value)}
                rows={3}
                style={{ width: "100%", padding: 12 }}
              />
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <input
                type="checkbox"
                checked={form.isFeatured}
                onChange={(e) => updateField("isFeatured", e.target.checked)}
              />
              Featured song
            </label>

            <label>
              <div>Lyrics (optional)</div>
              <textarea
                value={form.lyricsBody}
                onChange={(e) => updateField("lyricsBody", e.target.value)}
                rows={10}
                style={{ width: "100%", padding: 12 }}
              />
            </label>

            {isFriends ? (
              <section style={{ border: "1px solid rgba(255,255,255,0.12)", borderRadius: 16, padding: 16 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                  <input
                    type="checkbox"
                    checked={form.createConversation}
                    onChange={(e) => updateField("createConversation", e.target.checked)}
                  />
                  Create or update Fri.ends conversation
                </label>

                {form.createConversation ? (
                  <div style={{ display: "grid", gap: 16 }}>
                    <label>
                      <div>Conversation Slug</div>
                      <input
                        value={form.conversationSlug}
                        onChange={(e) => updateField("conversationSlug", slugify(e.target.value))}
                        style={{ width: "100%", padding: 12 }}
                      />
                    </label>

                    <label>
                      <div>Conversation Title</div>
                      <input
                        value={form.conversationTitle}
                        onChange={(e) => updateField("conversationTitle", e.target.value)}
                        style={{ width: "100%", padding: 12 }}
                      />
                    </label>

                    <label>
                      <div>Conversation Subtitle</div>
                      <input
                        value={form.conversationSubtitle}
                        onChange={(e) => updateField("conversationSubtitle", e.target.value)}
                        style={{ width: "100%", padding: 12 }}
                      />
                    </label>

                    <label>
                      <div>List Preview</div>
                      <input
                        value={form.listPreview}
                        onChange={(e) => updateField("listPreview", e.target.value)}
                        style={{ width: "100%", padding: 12 }}
                      />
                    </label>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                      <label>
                        <div>Avatar Letter</div>
                        <input
                          value={form.avatarLetter}
                          onChange={(e) => updateField("avatarLetter", e.target.value.slice(0, 1))}
                          maxLength={1}
                          style={{ width: "100%", padding: 12 }}
                        />
                      </label>

                      <label>
                        <div>Last Activity Label</div>
                        <input
                          value={form.lastActivityLabel}
                          onChange={(e) => updateField("lastActivityLabel", e.target.value)}
                          style={{ width: "100%", padding: 12 }}
                        />
                      </label>

                      <label>
                        <div>Sort Order</div>
                        <input
                          value={form.sortOrder}
                          onChange={(e) => updateField("sortOrder", e.target.value)}
                          type="number"
                          style={{ width: "100%", padding: 12 }}
                        />
                      </label>
                    </div>
                  </div>
                ) : null}
              </section>
            ) : null}

            <button type="submit" disabled={saving} style={{ padding: 14, borderRadius: 12 }}>
              {saving ? "Saving..." : mode === "new" ? "Create Song" : "Save Changes"}
            </button>

            {result ? <p style={{ margin: 0 }}>{result}</p> : null}
          </form>
        </>
      )}
    </main>
  );
}
