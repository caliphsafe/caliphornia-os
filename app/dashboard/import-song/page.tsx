"use client";

import { FormEvent, useEffect, useState } from "react";

type AppOption = {
  id: string;
  slug: string;
  name: string;
};

export default function ImportSongPage() {
  const [apps, setApps] = useState<AppOption[]>([]);
  const [loadingApps, setLoadingApps] = useState(true);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<string>("");

  const [form, setForm] = useState({
    appSlug: "",
    slug: "",
    title: "",
    artistName: "",
    producerNames: "",
    audioPath: "",
    coverImagePath: "",
    position: "",
    trackNumber: "",
    durationSeconds: "",
    durationLabel: "",
    displayDate: "",
    description: "",
    infoDescription: "",
    releaseStatus: "released",
    isFeatured: false,
    lyricsBody: ""
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
        }
      } catch {
        setResult("Could not load apps.");
      } finally {
        setLoadingApps(false);
      }
    }

    loadApps();
  }, []);

  function updateField<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({
      ...prev,
      [key]: value
    }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setResult("");

    try {
      const res = await fetch("/api/dashboard/import-song", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          appSlug: form.appSlug,
          slug: form.slug.trim(),
          title: form.title.trim(),
          artistName: form.artistName.trim(),
          producerNames: form.producerNames.trim(),
          audioPath: form.audioPath.trim(),
          coverImagePath: form.coverImagePath.trim(),
          position: form.position ? Number(form.position) : null,
          trackNumber: form.trackNumber ? Number(form.trackNumber) : null,
          durationSeconds: form.durationSeconds ? Number(form.durationSeconds) : null,
          durationLabel: form.durationLabel.trim() || null,
          displayDate: form.displayDate.trim() || null,
          description: form.description.trim() || null,
          infoDescription: form.infoDescription.trim() || null,
          releaseStatus: form.releaseStatus.trim() || "released",
          isFeatured: Boolean(form.isFeatured),
          lyricsBody: form.lyricsBody.trim() || null
        })
      });

      const data = await res.json();

      if (!data?.ok) {
        setResult(data?.error || "Could not import song.");
        return;
      }

      setResult(`Saved song "${data.song?.title}" to ${data.app?.slug}.`);
      setForm((prev) => ({
        ...prev,
        slug: "",
        title: "",
        artistName: "",
        producerNames: "",
        audioPath: "",
        coverImagePath: "",
        position: "",
        trackNumber: "",
        durationSeconds: "",
        durationLabel: "",
        displayDate: "",
        description: "",
        infoDescription: "",
        isFeatured: false,
        lyricsBody: ""
      }));
    } catch {
      setResult("Server error while saving.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main style={{ padding: "24px", maxWidth: 780, margin: "0 auto" }}>
      <h1 style={{ marginBottom: 8 }}>Import Song</h1>
      <p style={{ marginTop: 0, marginBottom: 24, opacity: 0.75 }}>
        Add a song, map it to an app, and optionally add lyrics.
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
            <div>Song Slug</div>
            <input
              value={form.slug}
              onChange={(e) => updateField("slug", e.target.value)}
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

          <label>
            <div>Audio Path (songs bucket)</div>
            <input
              value={form.audioPath}
              onChange={(e) => updateField("audioPath", e.target.value)}
              placeholder="friends/imax/imax-final.mp3"
              required
              style={{ width: "100%", padding: 12 }}
            />
          </label>

          <label>
            <div>Cover Path (cover-art bucket)</div>
            <input
              value={form.coverImagePath}
              onChange={(e) => updateField("coverImagePath", e.target.value)}
              placeholder="friends/imax/imax.png"
              style={{ width: "100%", padding: 12 }}
            />
          </label>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <label>
              <div>App Position</div>
              <input
                value={form.position}
                onChange={(e) => updateField("position", e.target.value)}
                placeholder="1"
                type="number"
                style={{ width: "100%", padding: 12 }}
              />
            </label>

            <label>
              <div>Track Number</div>
              <input
                value={form.trackNumber}
                onChange={(e) => updateField("trackNumber", e.target.value)}
                placeholder="1"
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
                placeholder="127"
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

          <button
            type="submit"
            disabled={saving}
            style={{
              padding: 14,
              borderRadius: 12,
              border: 0,
              cursor: "pointer"
            }}
          >
            {saving ? "Saving..." : "Save Song"}
          </button>

          {result ? <p style={{ margin: 0 }}>{result}</p> : null}
        </form>
      )}
    </main>
  );
}
