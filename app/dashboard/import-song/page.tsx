"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";

type AppOption = {
  id: string;
  slug: string;
  name: string;
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
  infoDescription: string;
  releaseStatus: string;
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
  conversationArtistNames: string;
  conversationProducerNames: string;
  conversationInfoDescription: string;
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

export default function ImportSongPage() {
  const [apps, setApps] = useState<AppOption[]>([]);
  const [loadingApps, setLoadingApps] = useState(true);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState("");
  const [audioFileName, setAudioFileName] = useState("");
  const [coverFileName, setCoverFileName] = useState("");

  const audioInputRef = useRef<HTMLInputElement | null>(null);
  const coverInputRef = useRef<HTMLInputElement | null>(null);

  const [form, setForm] = useState<FormState>({
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
    infoDescription: "",
    releaseStatus: "released",
    isFeatured: false,
    lyricsBody: "",
    createConversation: false,
    conversationSlug: "",
    conversationTitle: "",
    conversationSubtitle: "",
    listPreview: "",
    avatarLetter: "",
    lastActivityLabel: "",
    sortOrder: "",
    conversationArtistNames: "",
    conversationProducerNames: "",
    conversationInfoDescription: ""
  });

  useEffect(() => {
    async function loadApps() {
      try {
        const res = await fetch("/api/dashboard/import-song?mode=apps", {
          cache: "no-store"
        });
        const data = await res.json();

        if (data?.ok) {
          setApps(data.apps || []);
          if ((data.apps || []).length > 0) {
            setForm((prev) => ({
              ...prev,
              appSlug: prev.appSlug || data.apps[0].slug
            }));
          }
        } else {
          setResult(data?.error || "Could not load apps.");
        }
      } catch {
        setResult("Could not load apps.");
      } finally {
        setLoadingApps(false);
      }
    }

    loadApps();
  }, []);

  const isFriends = form.appSlug === "friends";

  const selectedAudioFile = audioInputRef.current?.files?.[0] || null;
  const selectedCoverFile = coverInputRef.current?.files?.[0] || null;

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({
      ...prev,
      [key]: value
    }));
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
      title: prev.title || inferredTitle,
      slug: prev.slug || inferredSlug,
      trackNumber: prev.trackNumber || prev.position || "",
      durationSeconds: prev.durationSeconds || (durationSeconds ? String(durationSeconds) : ""),
      durationLabel: prev.durationLabel || durationLabel,
      conversationSlug: prev.conversationSlug || (prev.appSlug === "friends" ? inferredSlug : prev.conversationSlug),
      conversationTitle: prev.conversationTitle || (prev.appSlug === "friends" ? inferredTitle : prev.conversationTitle),
      avatarLetter:
        prev.avatarLetter ||
        (prev.appSlug === "friends" && inferredTitle ? inferredTitle[0].toUpperCase() : prev.avatarLetter)
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
      if (!selectedAudioFile) {
        setResult("Please choose an audio file.");
        setSaving(false);
        return;
      }

      const payload = new FormData();
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
      payload.append("infoDescription", form.infoDescription.trim());
      payload.append("releaseStatus", form.releaseStatus.trim());
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
      payload.append("conversationArtistNames", form.conversationArtistNames.trim());
      payload.append("conversationProducerNames", form.conversationProducerNames.trim());
      payload.append("conversationInfoDescription", form.conversationInfoDescription.trim());

      payload.append("audioFile", selectedAudioFile);
      if (selectedCoverFile) {
        payload.append("coverFile", selectedCoverFile);
      }

      const res = await fetch("/api/dashboard/import-song", {
        method: "POST",
        body: payload
      });

      const data = await res.json();

      if (!data?.ok) {
        setResult(data?.error || "Could not save song.");
        setSaving(false);
        return;
      }

      setResult(
        data?.conversation
          ? `Saved "${data.song?.title}" and created conversation "${data.conversation?.title}".`
          : `Saved "${data.song?.title}".`
      );

      if (audioInputRef.current) audioInputRef.current.value = "";
      if (coverInputRef.current) coverInputRef.current.value = "";

      setAudioFileName("");
      setCoverFileName("");

      setForm((prev) => ({
        ...prev,
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
        infoDescription: "",
        isFeatured: false,
        lyricsBody: "",
        createConversation: false,
        conversationSlug: "",
        conversationTitle: "",
        conversationSubtitle: "",
        listPreview: "",
        avatarLetter: "",
        lastActivityLabel: "",
        sortOrder: "",
        conversationArtistNames: "",
        conversationProducerNames: "",
        conversationInfoDescription: ""
      }));
    } catch {
      setResult("Server error while saving.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main style={{ padding: 24, maxWidth: 820, margin: "0 auto" }}>
      <h1 style={{ marginBottom: 8 }}>Import Song</h1>
      <p style={{ marginTop: 0, marginBottom: 24, opacity: 0.75 }}>
        Upload audio and cover art, save the song, map it to an app, and optionally create a Fri.ends conversation.
      </p>

      {loadingApps ? (
        <p>Loading apps...</p>
      ) : (
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
            <div>Audio File</div>
            <input
              ref={audioInputRef}
              type="file"
              accept="audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/mp4,audio/aac"
              onChange={handleAudioChange}
              required
            />
            {audioFileName ? <div style={{ marginTop: 6, opacity: 0.7 }}>{audioFileName}</div> : null}
          </label>

          <label>
            <div>Cover File (optional)</div>
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
              placeholder="imax"
              required
              style={{ width: "100%", padding: 12 }}
            />
          </label>

          <label>
            <div>Title</div>
            <input
              value={form.title}
              onChange={(e) => updateField("title", e.target.value)}
              placeholder="iMax"
              required
              style={{ width: "100%", padding: 12 }}
            />
          </label>

          <label>
            <div>Artist Name</div>
            <input
              value={form.artistName}
              onChange={(e) => updateField("artistName", e.target.value)}
              placeholder="Caliph"
              required
              style={{ width: "100%", padding: 12 }}
            />
          </label>

          <label>
            <div>Producer Names</div>
            <input
              value={form.producerNames}
              onChange={(e) => updateField("producerNames", e.target.value)}
              placeholder="Producer 1, Producer 2"
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
                placeholder="2:07"
                style={{ width: "100%", padding: 12 }}
              />
            </label>
          </div>

          <label>
            <div>Display Date</div>
            <input
              value={form.displayDate}
              onChange={(e) => updateField("displayDate", e.target.value)}
              placeholder="Feb 28, 2025"
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

          <label>
            <div>Info Description</div>
            <textarea
              value={form.infoDescription}
              onChange={(e) => updateField("infoDescription", e.target.value)}
              rows={3}
              style={{ width: "100%", padding: 12 }}
            />
          </label>

          <label>
            <div>Release Status</div>
            <input
              value={form.releaseStatus}
              onChange={(e) => updateField("releaseStatus", e.target.value)}
              placeholder="released"
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
                Create Fri.ends conversation
              </label>

              {form.createConversation ? (
                <div style={{ display: "grid", gap: 16 }}>
                  <label>
                    <div>Conversation Slug</div>
                    <input
                      value={form.conversationSlug}
                      onChange={(e) => updateField("conversationSlug", slugify(e.target.value))}
                      placeholder="imax"
                      style={{ width: "100%", padding: 12 }}
                    />
                  </label>

                  <label>
                    <div>Conversation Title</div>
                    <input
                      value={form.conversationTitle}
                      onChange={(e) => updateField("conversationTitle", e.target.value)}
                      placeholder="iMax"
                      style={{ width: "100%", padding: 12 }}
                    />
                  </label>

                  <label>
                    <div>Conversation Subtitle</div>
                    <input
                      value={form.conversationSubtitle}
                      onChange={(e) => updateField("conversationSubtitle", e.target.value)}
                      placeholder="Caliph"
                      style={{ width: "100%", padding: 12 }}
                    />
                  </label>

                  <label>
                    <div>List Preview</div>
                    <input
                      value={form.listPreview}
                      onChange={(e) => updateField("listPreview", e.target.value)}
                      placeholder="nah this one crazy"
                      style={{ width: "100%", padding: 12 }}
                    />
                  </label>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                    <label>
                      <div>Avatar Letter</div>
                      <input
                        value={form.avatarLetter}
                        onChange={(e) => updateField("avatarLetter", e.target.value.slice(0, 1))}
                        placeholder="I"
                        maxLength={1}
                        style={{ width: "100%", padding: 12 }}
                      />
                    </label>

                    <label>
                      <div>Last Activity Label</div>
                      <input
                        value={form.lastActivityLabel}
                        onChange={(e) => updateField("lastActivityLabel", e.target.value)}
                        placeholder="7:15 PM"
                        style={{ width: "100%", padding: 12 }}
                      />
                    </label>

                    <label>
                      <div>Sort Order</div>
                      <input
                        value={form.sortOrder}
                        onChange={(e) => updateField("sortOrder", e.target.value)}
                        type="number"
                        placeholder="1"
                        style={{ width: "100%", padding: 12 }}
                      />
                    </label>
                  </div>

                  <label>
                    <div>Conversation Artist Names</div>
                    <input
                      value={form.conversationArtistNames}
                      onChange={(e) => updateField("conversationArtistNames", e.target.value)}
                      placeholder="Caliph"
                      style={{ width: "100%", padding: 12 }}
                    />
                  </label>

                  <label>
                    <div>Conversation Producer Names</div>
                    <input
                      value={form.conversationProducerNames}
                      onChange={(e) => updateField("conversationProducerNames", e.target.value)}
                      placeholder="Producer 1, Producer 2"
                      style={{ width: "100%", padding: 12 }}
                    />
                  </label>

                  <label>
                    <div>Conversation Info Description</div>
                    <textarea
                      value={form.conversationInfoDescription}
                      onChange={(e) => updateField("conversationInfoDescription", e.target.value)}
                      rows={3}
                      style={{ width: "100%", padding: 12 }}
                    />
                  </label>
                </div>
              ) : null}
            </section>
          ) : null}

          <button
            type="submit"
            disabled={saving}
            style={{ padding: 14, borderRadius: 12, border: 0, cursor: "pointer" }}
          >
            {saving ? "Saving..." : "Save Song"}
          </button>

          {result ? <p style={{ margin: 0 }}>{result}</p> : null}
        </form>
      )}
    </main>
  );
}
