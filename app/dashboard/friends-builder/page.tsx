"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";

type SongOption = {
  slug: string;
  title: string;
  artist_name: string | null;
  audio_path: string | null;
  audio_url: string | null;
  description: string | null;
};

type ConversationOption = {
  slug: string;
  title: string;
};

type AssetRow = {
  clientId: string;
  slug: string;
  title: string;
  file: File | null;
  existingAudioUrl?: string | null;
};

type MessageRow = {
  clientId: string;
  messageType: "timestamp" | "text" | "audio";
  messageSide: "incoming" | "outgoing" | "center";
  senderName: string;
  body: string;
  audioSourceSlug: string;
  audioLabel: string;
  audioKind: string;
  clipStart: number;
  clipEnd: number | null;
  clipDurationLabel: string;
};

type AudioSourceOption = {
  slug: string;
  label: string;
  url: string | null;
};

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function formatDurationLabel(totalSeconds: number) {
  const safe = Math.max(0, totalSeconds || 0);
  const mm = Math.floor(safe / 60);
  const ss = Math.round(safe % 60);
  return `${mm}:${String(ss).padStart(2, "0")}`;
}

function getInitials(name: string) {
  const clean = String(name || "").trim();
  if (!clean) return "•";
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
}

const EMPTY_MESSAGE = (): MessageRow => ({
  clientId: uid(),
  messageType: "text",
  messageSide: "incoming",
  senderName: "",
  body: "",
  audioSourceSlug: "",
  audioLabel: "",
  audioKind: "Song",
  clipStart: 0,
  clipEnd: null,
  clipDurationLabel: ""
});

const EMPTY_ASSET = (): AssetRow => ({
  clientId: uid(),
  slug: "",
  title: "",
  file: null,
  existingAudioUrl: null
});

function AudioClipEditor({
  sourceUrl,
  clipStart,
  clipEnd,
  onChange
}: {
  sourceUrl: string | null;
  clipStart: number;
  clipEnd: number | null;
  onChange: (patch: {
    clipStart?: number;
    clipEnd?: number | null;
    clipDurationLabel?: string;
  }) => void;
}) {
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    setDuration(0);
  }, [sourceUrl]);

  function syncValues(nextStart: number, nextEnd: number | null, totalDuration: number) {
    const total = Math.max(0, totalDuration || 0);
    const safeStart = Math.max(0, Math.min(nextStart, total));
    const safeEnd = nextEnd === null ? total : Math.max(safeStart, Math.min(nextEnd, total));

    onChange({
      clipStart: Number(safeStart.toFixed(2)),
      clipEnd: Number(safeEnd.toFixed(2)),
      clipDurationLabel: formatDurationLabel(safeEnd - safeStart)
    });
  }

  const waveBars = Array.from({ length: 48 }, (_, i) => {
    const base = 12 + ((i * 7) % 26);
    return base;
  });

  const total = duration || 0;
  const startPct = total > 0 ? (clipStart / total) * 100 : 0;
  const endPct = total > 0 ? (((clipEnd ?? total) / total) * 100) : 100;

  return (
    <div className="clip-card">
      <div className="clip-copy">Choose the section of the audio that should play for this entry.</div>

      {sourceUrl ? (
        <audio
          controls
          src={sourceUrl}
          className="clip-audio"
          onLoadedMetadata={(e) => {
            const d = Number(e.currentTarget.duration || 0);
            setDuration(d);
            const endToUse = clipEnd === null || clipEnd === 0 ? d : Math.min(clipEnd, d);
            const startToUse = Math.min(clipStart || 0, endToUse);
            onChange({
              clipStart: Number(startToUse.toFixed(2)),
              clipEnd: Number(endToUse.toFixed(2)),
              clipDurationLabel: formatDurationLabel(endToUse - startToUse)
            });
          }}
        />
      ) : (
        <div className="clip-muted">Choose an audio source first.</div>
      )}

      <div className="wave-shell">
        <div className="wave-bars">
          {waveBars.map((h, i) => (
            <span key={i} className="wave-bar" style={{ height: h }} />
          ))}
        </div>

        <div
          className="wave-highlight"
          style={{
            left: `${startPct}%`,
            width: `${Math.max(0, endPct - startPct)}%`
          }}
        />
      </div>

      <div className="clip-grid">
        <label className="clip-label">
          <div>Start: {clipStart.toFixed(2)}s</div>
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={Math.min(clipStart, duration || 0)}
            disabled={!sourceUrl || !duration}
            onChange={(e) => {
              const nextStart = Number(e.target.value);
              const currentEnd = clipEnd === null ? duration : clipEnd;
              syncValues(nextStart, currentEnd, duration);
            }}
          />
        </label>

        <label className="clip-label">
          <div>End: {(clipEnd ?? duration ?? 0).toFixed(2)}s</div>
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={Math.min(clipEnd ?? duration ?? 0, duration || 0)}
            disabled={!sourceUrl || !duration}
            onChange={(e) => {
              const nextEnd = Number(e.target.value);
              syncValues(clipStart, nextEnd, duration);
            }}
          />
        </label>
      </div>

      <div className="clip-length">
        Clip length: {formatDurationLabel(Math.max(0, (clipEnd ?? duration ?? 0) - clipStart))}
      </div>
    </div>
  );
}

function PreviewPhone({
  conversationTitle,
  listPreview,
  selectedSong,
  messages,
  audioSourceOptions
}: {
  conversationTitle: string;
  listPreview: string;
  selectedSong: SongOption | null;
  messages: MessageRow[];
  audioSourceOptions: AudioSourceOption[];
}) {
  function resolveSourceLabel(slug: string) {
    return audioSourceOptions.find((a) => a.slug === slug)?.label || slug || "Audio";
  }

  return (
    <div className="preview-wrap">
      <div className="phone-shell">
        <div className="phone-notch" />

        <div className="phone-topbar">
          <div className="phone-back">‹ Fri.ends</div>
          <div className="phone-header">
            <div className="phone-avatar">{getInitials(conversationTitle || selectedSong?.title || "F")}</div>
            <div>
              <div className="phone-title">{conversationTitle || selectedSong?.title || "Conversation"}</div>
              <div className="phone-sub">{selectedSong?.artist_name || "Artists"}</div>
            </div>
          </div>
          <div className="phone-more">⋯</div>
        </div>

        <div className="phone-inbox-preview">
          <span className="phone-inbox-label">Inbox preview</span>
          <span className="phone-inbox-text">{listPreview || "What shows in the inbox preview"}</span>
        </div>

        <div className="phone-thread">
          {messages.length === 0 ? (
            <div className="phone-empty">Add messages to preview the conversation.</div>
          ) : (
            messages.map((msg) => {
              if (msg.messageType === "timestamp") {
                return (
                  <div className="bubble-time" key={msg.clientId}>
                    {msg.body || "Today 7:15 PM"}
                  </div>
                );
              }

              const outgoing = msg.messageSide === "outgoing";
              const sender = msg.senderName || (outgoing ? "Caliph" : "Sender");

              return (
                <div
                  key={msg.clientId}
                  className={`bubble-row ${outgoing ? "outgoing" : "incoming"}`}
                >
                  {!outgoing ? (
                    <div className="bubble-avatar">{getInitials(sender)}</div>
                  ) : null}

                  <div className="bubble-stack">
                    {!outgoing ? <div className="bubble-sender">{sender}</div> : null}

                    {msg.messageType === "text" ? (
                      <div className={`bubble ${outgoing ? "bubble-blue" : "bubble-gray"}`}>
                        {msg.body || (outgoing ? "Type your message" : "Type collaborator message")}
                      </div>
                    ) : (
                      <div className={`bubble bubble-audio ${outgoing ? "bubble-blue" : "bubble-gray"}`}>
                        <div className="audio-pill-top">
                          <span>{msg.audioLabel || resolveSourceLabel(msg.audioSourceSlug)}</span>
                          <span>{msg.audioKind || "Song"}</span>
                        </div>
                        <div className="audio-wave">
                          {Array.from({ length: 22 }, (_, i) => (
                            <span key={i} style={{ height: 8 + ((i * 5) % 18) }} />
                          ))}
                        </div>
                        <div className="audio-pill-bottom">
                          <span>{resolveSourceLabel(msg.audioSourceSlug)}</span>
                          <span>{msg.clipDurationLabel || "0:00"}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

export default function FriendsBuilderPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefillSongSlug = searchParams.get("song") || "";

  const [songs, setSongs] = useState<SongOption[]>([]);
  const [conversations, setConversations] = useState<ConversationOption[]>([]);
  const [selectedConversationSlug, setSelectedConversationSlug] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState("");

  const [primarySongSlug, setPrimarySongSlug] = useState("");
  const [conversationSlug, setConversationSlug] = useState("");
  const [conversationTitle, setConversationTitle] = useState("");
  const [listPreview, setListPreview] = useState("");
  const [sortOrder, setSortOrder] = useState("");

  const [assetsOpen, setAssetsOpen] = useState(false);
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [messages, setMessages] = useState<MessageRow[]>([EMPTY_MESSAGE()]);

  const selectedSong = useMemo(
    () => songs.find((s) => s.slug === primarySongSlug) || null,
    [songs, primarySongSlug]
  );

  async function createSignedUploadTarget(bucket: string, path: string, upsert = true) {
    const res = await fetch("/api/dashboard/storage-upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bucket, path, upsert })
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

  const senderOptions = useMemo(() => {
  const names = new Set<string>();
  names.add("Caliph");

  const collectNames = (value: string | null | undefined) => {
    String(value || "")
      .split(/,|&|\band\b|\bfeat\.?\b|\bft\.?\b/gi)
      .map((name) => name.trim())
      .filter(Boolean)
      .forEach((name) => names.add(name));
  };

  collectNames(selectedSong?.artist_name);
  collectNames(selectedSong?.producer_names);

  return Array.from(names);
}, [selectedSong]);

  const audioSourceOptions = useMemo<AudioSourceOption[]>(() => {
    const base: AudioSourceOption[] = [];

    if (selectedSong) {
      base.push({
        slug: selectedSong.slug,
        label: `Main Song (${selectedSong.title})`,
        url: selectedSong.audio_url || null
      });
    }

    for (const asset of assets) {
      if (!asset.slug) continue;
      base.push({
        slug: asset.slug,
        label: asset.title ? asset.title : asset.slug,
        url: asset.existingAudioUrl || null
      });
    }

    return base;
  }, [selectedSong, assets]);

  async function loadBoot() {
    setLoading(true);
    setResult("");

    try {
      const [songsRes, convosRes] = await Promise.all([
        fetch("/api/dashboard/friends-builder?mode=songs", { cache: "no-store" }),
        fetch("/api/dashboard/friends-builder?mode=conversations", { cache: "no-store" })
      ]);

      const songsData = await songsRes.json();
      const convosData = await convosRes.json();

      if (songsData?.ok) setSongs(songsData.songs || []);
      if (convosData?.ok) setConversations(convosData.conversations || []);
    } catch {
      setResult("Could not load builder data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBoot();
  }, []);

  useEffect(() => {
    if (!prefillSongSlug || loading || songs.length === 0) return;

    const song = songs.find((s) => s.slug === prefillSongSlug);
    if (!song) return;

    setPrimarySongSlug(song.slug);
    setConversationSlug(song.slug);
    setConversationTitle(song.title);
    setListPreview(song.description || "");
    setMessages((prev) =>
      prev.length
        ? prev.map((msg) =>
            msg.messageType === "audio" && !msg.audioSourceSlug
              ? { ...msg, audioSourceSlug: song.slug }
              : msg
          )
        : [EMPTY_MESSAGE()]
    );
  }, [prefillSongSlug, loading, songs]);

  async function loadConversation(slug: string) {
    if (!slug) return;
    setResult("");

    try {
      const res = await fetch(
        `/api/dashboard/friends-builder?mode=conversation-detail&slug=${encodeURIComponent(slug)}`,
        { cache: "no-store" }
      );
      const data = await res.json();

      if (!data?.ok) {
        setResult(data?.error || "Could not load conversation.");
        return;
      }

      const detail = data.detail;

      setPrimarySongSlug(detail.primarySongSlug || "");
      setConversationSlug(detail.conversation.slug || "");
      setConversationTitle(detail.conversation.title || "");
      setListPreview(detail.conversation.list_preview || "");
      setSortOrder(
        detail.conversation.sort_order !== null && detail.conversation.sort_order !== undefined
          ? String(detail.conversation.sort_order)
          : ""
      );

      const loadedAssets = (detail.assets || []).map((a: any) => ({
        clientId: uid(),
        slug: a.slug || "",
        title: a.title || "",
        file: null,
        existingAudioUrl: a.audio_url || null
      }));

      setAssets(loadedAssets);
      setAssetsOpen(loadedAssets.length > 0);

      setMessages(
        (detail.messages || []).map((m: any) => ({
          clientId: uid(),
          messageType: m.message_type,
          messageSide: m.message_side || (m.message_type === "timestamp" ? "center" : "incoming"),
          senderName: m.sender_name || "",
          body: m.body || "",
          audioSourceSlug: m.asset_slug || detail.primarySongSlug || "",
          audioLabel: m.audio_label || "",
          audioKind: m.audio_kind || "Song",
          clipStart: Number(m.start_seconds || 0),
          clipEnd:
            m.end_seconds !== null && m.end_seconds !== undefined
              ? Number(m.end_seconds)
              : null,
          clipDurationLabel: m.display_duration || ""
        }))
      );
    } catch {
      setResult("Could not load conversation.");
    }
  }

  function resetBuilder() {
    setSelectedConversationSlug("");
    setPrimarySongSlug("");
    setConversationSlug("");
    setConversationTitle("");
    setListPreview("");
    setSortOrder("");
    setAssetsOpen(false);
    setAssets([]);
    setMessages([EMPTY_MESSAGE()]);
    setResult("");
  }

  function updateAsset(clientId: string, patch: Partial<AssetRow>) {
    setAssets((prev) =>
      prev.map((row) => (row.clientId === clientId ? { ...row, ...patch } : row))
    );
  }

  function updateMessage(clientId: string, patch: Partial<MessageRow>) {
    setMessages((prev) =>
      prev.map((row) => {
        if (row.clientId !== clientId) return row;

        const next = { ...row, ...patch };

        if (
          next.messageType === "audio" &&
          (patch.clipStart !== undefined || patch.clipEnd !== undefined)
        ) {
          const safeStart = Number(next.clipStart || 0);
          const safeEnd =
            next.clipEnd === null || next.clipEnd === undefined
              ? null
              : Number(next.clipEnd);
          next.clipDurationLabel =
            safeEnd !== null
              ? formatDurationLabel(Math.max(0, safeEnd - safeStart))
              : next.clipDurationLabel;
        }

        return next;
      })
    );
  }

  function removeAsset(clientId: string) {
    setAssets((prev) => prev.filter((row) => row.clientId !== clientId));
  }

  function removeMessage(clientId: string) {
    setMessages((prev) => prev.filter((row) => row.clientId !== clientId));
  }

  function handlePrimarySongChange(nextSlug: string) {
    setPrimarySongSlug(nextSlug);
    const song = songs.find((s) => s.slug === nextSlug);
    if (!song) return;

    if (!conversationSlug) setConversationSlug(song.slug);
    if (!conversationTitle) setConversationTitle(song.title);
    if (!listPreview) setListPreview(song.description || "");

    setMessages((prev) =>
      prev.map((msg) => ({
        ...msg,
        senderName:
          !msg.senderName && msg.messageType !== "timestamp"
            ? "Caliph"
            : msg.senderName,
        messageSide:
          msg.messageType === "timestamp"
            ? "center"
            : !msg.senderName
            ? "outgoing"
            : msg.messageSide,
        audioSourceSlug:
          msg.messageType === "audio" && !msg.audioSourceSlug
            ? song.slug
            : msg.audioSourceSlug
      }))
    );
  }

  async function handleSaveConversation(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setResult("");

    try {
      if (!primarySongSlug || !conversationSlug || !conversationTitle) {
        setResult("Primary song, conversation title, and conversation slug are required.");
        setSaving(false);
        return;
      }

      const payload = new FormData();
      payload.append("action", "save-conversation");
      payload.append("selectedConversationSlug", selectedConversationSlug);
      payload.append("primarySongSlug", primarySongSlug);
      payload.append("conversationSlug", slugify(conversationSlug));
      payload.append("conversationTitle", conversationTitle);
      payload.append("conversationSubtitle", selectedSong?.artist_name || "");
      payload.append("listPreview", listPreview);
      payload.append("avatarLetter", (conversationTitle[0] || "F").toUpperCase());
      payload.append("lastActivityLabel", "");
      payload.append("sortOrder", sortOrder);

      payload.append(
        "assets",
        JSON.stringify(
          assets.map((a) => ({
            clientId: a.clientId,
            slug: a.slug,
            title: a.title,
            versionLabel: "",
            isPlaylistable: false,
            linkedSongSlug: ""
          }))
        )
      );

      payload.append(
        "messages",
        JSON.stringify(
          messages.map((m, index) => ({
            position: index + 1,
            messageType: m.messageType,
            senderName: m.messageType === "timestamp" ? "" : m.senderName || "",
            senderLabel:
              m.messageType === "timestamp"
                ? ""
                : m.senderName && m.senderName !== "Caliph"
                ? m.senderName
                : "",
            body: m.body,
            messageSide: m.messageType === "timestamp" ? "center" : m.messageSide,
            displayTime: "",
            audioLabel: m.audioLabel,
            audioKind: m.audioKind,
            assetSlug: m.messageType === "audio" ? m.audioSourceSlug || primarySongSlug : "",
            clipTitle:
              m.messageType === "audio" ? m.audioLabel || m.audioKind || "Audio" : "",
            startSeconds: m.messageType === "audio" ? String(m.clipStart || 0) : "",
            endSeconds:
              m.messageType === "audio" && m.clipEnd !== null ? String(m.clipEnd) : "",
            displayDuration: m.messageType === "audio" ? m.clipDurationLabel || "" : ""
          }))
        )
      );

      for (const asset of assets) {
        if (!asset.file || !selectedSong) continue;

        const cleanSlug = slugify(asset.slug || asset.title);
        if (!cleanSlug) continue;

        const ext = (asset.file.name.split(".").pop() || "mp3").toLowerCase();
        const storagePath = `friends/${selectedSong.slug}/${cleanSlug}.${ext}`;

        const target = await createSignedUploadTarget("songs", storagePath, true);
        await uploadFileToSignedUrl("songs", target.path, target.token, asset.file);

        payload.append(
          `assetUpload__${asset.clientId}`,
          JSON.stringify({
            slug: cleanSlug,
            storagePath
          })
        );
      }

      const res = await fetch("/api/dashboard/friends-builder", {
        method: "POST",
        body: payload
      });

      const data = await res.json();

      if (!data?.ok) {
        setResult(data?.error || "Could not save conversation.");
        setSaving(false);
        return;
      }

      setResult(`Saved conversation "${data.conversation?.title}".`);
      await loadBoot();
      setSelectedConversationSlug(data.conversation?.slug || slugify(conversationSlug));
    } catch {
      setResult("Server error while saving conversation.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="builder-wrap">
      <div className="builder-hero">
        <div>
          <h1>Fri.ends Conversation Builder</h1>
          <p>
            Build the story of how the song came together. Works on desktop and mobile.
          </p>
        </div>

        <div className="builder-hero-actions">
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="ghost-btn"
          >
            Back to Dashboard
          </button>

          <button
            type="button"
            onClick={resetBuilder}
            className="ghost-btn"
          >
            New Conversation
          </button>

          <select
            value={selectedConversationSlug}
            onChange={(e) => {
              const slug = e.target.value;
              setSelectedConversationSlug(slug);
              if (slug) loadConversation(slug);
            }}
            className="hero-select"
          >
            <option value="">Edit Existing Conversation</option>
            {conversations.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.title} ({c.slug})
              </option>
            ))}
          </select>

          {conversationSlug ? (
            <a
              href={`/apps/friends/${slugify(conversationSlug)}`}
              target="_blank"
              rel="noreferrer"
              className="ghost-link"
            >
              Preview in Fri.ends
            </a>
          ) : null}
        </div>
      </div>

      {loading ? (
        <p className="muted">Loading…</p>
      ) : (
        <div className="builder-grid">
          <form onSubmit={handleSaveConversation} className="builder-form">
            <section className="panel">
              <h2>Conversation Setup</h2>

              <div className="grid-two">
                <label className="field">
                  <span>Primary Song</span>
                  <select
                    value={primarySongSlug}
                    onChange={(e) => handlePrimarySongChange(e.target.value)}
                  >
                    <option value="">Choose the main song for this thread</option>
                    {songs.map((song) => (
                      <option key={song.slug} value={song.slug}>
                        {song.title} ({song.slug})
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span>Conversation Title</span>
                  <input
                    value={conversationTitle}
                    onChange={(e) => setConversationTitle(e.target.value)}
                    placeholder="Conversation title, e.g. iMax"
                  />
                </label>
              </div>

              <div className="grid-two">
                <label className="field">
                  <span>Conversation Slug</span>
                  <input
                    value={conversationSlug}
                    onChange={(e) => setConversationSlug(slugify(e.target.value))}
                    placeholder="Auto route, e.g. imax"
                  />
                </label>

                <label className="field">
                  <span>Inbox Preview</span>
                  <input
                    value={listPreview}
                    onChange={(e) => setListPreview(e.target.value)}
                    placeholder="What shows in the inbox preview"
                  />
                </label>
              </div>

              <div className="grid-small">
                <label className="field">
                  <span>Sort Order</span>
                  <input
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value)}
                    type="number"
                    placeholder="1 = top"
                  />
                </label>
              </div>
            </section>

            <section className="panel">
              <div className="section-head">
                <div>
                  <h2>Messages</h2>
                  <p className="muted">
                    Timestamps only need timestamp text. Audio entries can preview and trim visually.
                  </p>
                </div>

                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() => {
                    const next = EMPTY_MESSAGE();
                    next.senderName = "Caliph";
                    next.messageSide = "outgoing";
                    if (primarySongSlug) next.audioSourceSlug = primarySongSlug;
                    setMessages((prev) => [...prev, next]);
                  }}
                >
                  Add Message
                </button>
              </div>

              <div className="message-list">
                {messages.map((msg, index) => {
                  const selectedSource =
                    audioSourceOptions.find((source) => source.slug === msg.audioSourceSlug) ||
                    null;

                  return (
                    <div key={msg.clientId} className="message-card">
                      <div className="message-head">
                        <strong>Message {index + 1}</strong>
                        <button
                          type="button"
                          className="tiny-btn"
                          onClick={() => removeMessage(msg.clientId)}
                        >
                          Remove
                        </button>
                      </div>

                      <div
                        className={`message-grid ${
                          msg.messageType === "timestamp" ? "timestamp-grid" : ""
                        }`}
                      >
                        <label className="field">
                          <span>Type</span>
                          <select
                            value={msg.messageType}
                            onChange={(e) => {
                              const nextType = e.target.value as MessageRow["messageType"];
                              updateMessage(msg.clientId, {
                                messageType: nextType,
                                messageSide:
                                  nextType === "timestamp" ? "center" : msg.messageSide,
                                audioSourceSlug:
                                  nextType === "audio"
                                    ? msg.audioSourceSlug || primarySongSlug
                                    : "",
                                audioLabel: nextType === "audio" ? msg.audioLabel : "",
                                audioKind: nextType === "audio" ? msg.audioKind || "Song" : "",
                                clipStart: nextType === "audio" ? msg.clipStart || 0 : 0,
                                clipEnd: nextType === "audio" ? msg.clipEnd : null,
                                clipDurationLabel:
                                  nextType === "audio" ? msg.clipDurationLabel || "" : ""
                              });
                            }}
                          >
                            <option value="text">Text</option>
                            <option value="audio">Audio</option>
                            <option value="timestamp">Timestamp</option>
                          </select>
                        </label>

                        {msg.messageType !== "timestamp" ? (
                          <label className="field">
                            <span>Sender</span>
                            <select
                              value={msg.senderName}
                              onChange={(e) => {
                                const sender = e.target.value;
                                updateMessage(msg.clientId, {
                                  senderName: sender,
                                  messageSide: sender === "Caliph" ? "outgoing" : "incoming"
                                });
                              }}
                            >
                              <option value="">Choose sender</option>
                              {senderOptions.map((name) => (
                                <option key={name} value={name}>
                                  {name}
                                </option>
                              ))}
                            </select>
                          </label>
                        ) : null}

                        {msg.messageType === "timestamp" ? (
                          <label className="field wide-field">
                            <span>Timestamp Text</span>
                            <input
                              value={msg.body}
                              onChange={(e) =>
                                updateMessage(msg.clientId, { body: e.target.value })
                              }
                              placeholder="e.g. Today 7:15 PM"
                            />
                          </label>
                        ) : msg.messageType === "text" ? (
                          <label className="field wide-field">
                            <span>Message</span>
                            <input
                              value={msg.body}
                              onChange={(e) =>
                                updateMessage(msg.clientId, { body: e.target.value })
                              }
                              placeholder={
                                msg.senderName === "Caliph"
                                  ? "Type your message"
                                  : "Type collaborator message"
                              }
                            />
                          </label>
                        ) : (
                          <div />
                        )}
                      </div>

                      {msg.messageType === "audio" ? (
                        <>
                          <div className="audio-grid">
                            <label className="field">
                              <span>Audio Source</span>
                              <select
                                value={msg.audioSourceSlug}
                                onChange={(e) =>
                                  updateMessage(msg.clientId, {
                                    audioSourceSlug: e.target.value
                                  })
                                }
                              >
                                <option value="">Choose audio source</option>
                                {audioSourceOptions.map((source) => (
                                  <option key={source.slug} value={source.slug}>
                                    {source.label}
                                  </option>
                                ))}
                              </select>
                            </label>

                            <label className="field">
                              <span>Bubble Label</span>
                              <input
                                value={msg.audioLabel}
                                onChange={(e) =>
                                  updateMessage(msg.clientId, {
                                    audioLabel: e.target.value
                                  })
                                }
                                placeholder="e.g. Main, Open Verse, Demo"
                              />
                            </label>

                            <label className="field">
                              <span>Kind</span>
                              <select
                                value={msg.audioKind}
                                onChange={(e) =>
                                  updateMessage(msg.clientId, {
                                    audioKind: e.target.value
                                  })
                                }
                              >
                                <option value="Song">Song</option>
                                <option value="Demo">Demo</option>
                                <option value="Beat">Beat</option>
                                <option value="Voice note">Voice note</option>
                                <option value="Open Verse">Open Verse</option>
                              </select>
                            </label>
                          </div>

                          <AudioClipEditor
                            sourceUrl={selectedSource?.url || null}
                            clipStart={msg.clipStart}
                            clipEnd={msg.clipEnd}
                            onChange={(patch) => updateMessage(msg.clientId, patch)}
                          />
                        </>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="panel">
              <div className="section-head">
                <div>
                  <h2>Alternate Versions (Optional)</h2>
                  <p className="muted">Skip this if you only want to use the main song.</p>
                </div>

                <div className="section-head-actions">
                  <button
                    type="button"
                    className="ghost-btn"
                    onClick={() => setAssetsOpen((prev) => !prev)}
                  >
                    {assetsOpen ? "Hide" : "Show"}
                  </button>

                  {assetsOpen ? (
                    <button
                      type="button"
                      className="ghost-btn"
                      onClick={() => setAssets((prev) => [...prev, EMPTY_ASSET()])}
                    >
                      Add Version
                    </button>
                  ) : null}
                </div>
              </div>

              {assetsOpen ? (
                <div className="asset-list">
                  {!assets.length ? <p className="muted">No alternate versions added.</p> : null}

                  {assets.map((asset) => (
                    <div key={asset.clientId} className="asset-card">
                      <div className="grid-two asset-grid">
                        <label className="field">
                          <span>Version Title</span>
                          <input
                            value={asset.title}
                            onChange={(e) => {
                              const nextTitle = e.target.value;
                              updateAsset(asset.clientId, {
                                title: nextTitle,
                                slug: asset.slug || slugify(nextTitle)
                              });
                            }}
                            placeholder="e.g. iMax Open Verse"
                          />
                        </label>

                        <label className="field">
                          <span>Version Slug</span>
                          <input
                            value={asset.slug}
                            onChange={(e) =>
                              updateAsset(asset.clientId, {
                                slug: slugify(e.target.value)
                              })
                            }
                            placeholder="auto-generated from title"
                          />
                        </label>
                      </div>

                      <div className="asset-actions">
                        <input
                          type="file"
                          accept="audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/mp4,audio/aac"
                          onChange={(e) =>
                            updateAsset(asset.clientId, {
                              file: e.target.files?.[0] || null
                            })
                          }
                        />

                        <button
                          type="button"
                          className="tiny-btn"
                          onClick={() => removeAsset(asset.clientId)}
                        >
                          Remove
                        </button>
                      </div>

                      {asset.file ? (
                        <div className="muted" style={{ marginTop: 8 }}>
                          {asset.file.name}
                        </div>
                      ) : asset.existingAudioUrl ? (
                        <div className="muted" style={{ marginTop: 8 }}>
                          Existing audio attached
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}
            </section>

            <button type="submit" disabled={saving} className="save-btn">
              {saving ? "Saving..." : "Save Conversation"}
            </button>

            {result ? <p className="save-result">{result}</p> : null}
          </form>

          <aside className="preview-column">
            <PreviewPhone
              conversationTitle={conversationTitle}
              listPreview={listPreview}
              selectedSong={selectedSong}
              messages={messages}
              audioSourceOptions={audioSourceOptions}
            />
          </aside>
        </div>
      )}
    </main>
  );
}
