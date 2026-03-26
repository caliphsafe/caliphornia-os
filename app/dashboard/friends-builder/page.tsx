"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
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
    const safeStart = Math.max(0, Math.min(nextStart, totalDuration || 0));
    const safeEnd =
      nextEnd === null
        ? totalDuration || 0
        : Math.max(safeStart, Math.min(nextEnd, totalDuration || 0));

    onChange({
      clipStart: Number(safeStart.toFixed(2)),
      clipEnd: Number(safeEnd.toFixed(2)),
      clipDurationLabel: formatDurationLabel(safeEnd - safeStart)
    });
  }

  return (
    <div
      style={{
        marginTop: 12,
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 12,
        padding: 12
      }}
    >
      <div style={{ marginBottom: 10, fontSize: 13, opacity: 0.75 }}>
        Select the part of the audio that should play for this entry.
      </div>

      {sourceUrl ? (
        <audio
          controls
          src={sourceUrl}
          style={{ width: "100%", marginBottom: 12 }}
          onLoadedMetadata={(e) => {
            const d = Number(e.currentTarget.duration || 0);
            setDuration(d);

            const endToUse =
              clipEnd === null || clipEnd === 0 ? d : Math.min(clipEnd, d);
            const startToUse = Math.min(clipStart || 0, endToUse);

            onChange({
              clipStart: Number(startToUse.toFixed(2)),
              clipEnd: Number(endToUse.toFixed(2)),
              clipDurationLabel: formatDurationLabel(endToUse - startToUse)
            });
          }}
        />
      ) : (
        <div style={{ marginBottom: 12, opacity: 0.7 }}>
          Choose an audio source to preview and trim.
        </div>
      )}

      <div style={{ display: "grid", gap: 10 }}>
        <label>
          <div style={{ marginBottom: 6 }}>
            Start: {clipStart.toFixed(2)}s
          </div>
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
            style={{ width: "100%" }}
          />
        </label>

        <label>
          <div style={{ marginBottom: 6 }}>
            End: {(clipEnd ?? duration ?? 0).toFixed(2)}s
          </div>
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
            style={{ width: "100%" }}
          />
        </label>

        <div style={{ fontSize: 13, opacity: 0.8 }}>
          Clip length: {clipDurationLabelFromValues(clipStart, clipEnd, duration)}
        </div>
      </div>
    </div>
  );

  function clipDurationLabelFromValues(
    start: number,
    end: number | null,
    total: number
  ) {
    const safeEnd = end === null ? total : end;
    return formatDurationLabel(Math.max(0, safeEnd - start));
  }
}

export default function FriendsBuilderPage() {
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

  const senderOptions = useMemo(() => {
    const names = new Set<string>();

    names.add("Caliph");

    const rawArtists = selectedSong?.artist_name || "";
    rawArtists
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean)
      .forEach((name) => names.add(name));

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
        fetch("/api/dashboard/friends-builder?mode=conversations", {
          cache: "no-store"
        })
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
        `/api/dashboard/friends-builder?mode=conversation-detail&slug=${encodeURIComponent(
          slug
        )}`,
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
        detail.conversation.sort_order !== null &&
          detail.conversation.sort_order !== undefined
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
            assetSlug:
              m.messageType === "audio"
                ? m.audioSourceSlug || primarySongSlug
                : "",
            clipTitle:
              m.messageType === "audio"
                ? m.audioLabel || m.audioKind || "Audio"
                : "",
            startSeconds:
              m.messageType === "audio" ? String(m.clipStart || 0) : "",
            endSeconds:
              m.messageType === "audio" && m.clipEnd !== null
                ? String(m.clipEnd)
                : "",
            displayDuration:
              m.messageType === "audio" ? m.clipDurationLabel || "" : ""
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
    <main style={{ padding: 24, maxWidth: 980, margin: "0 auto" }}>
      <h1 style={{ marginBottom: 8 }}>Fri.ends Conversation Builder</h1>
      <p style={{ marginTop: 0, marginBottom: 24, opacity: 0.75 }}>
        Build the conversation first. Add alternate versions only if you need them.
      </p>

      {loading ? (
        <p>Loading…</p>
      ) : (
        <>
          <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={resetBuilder}
              style={{ padding: "10px 14px", borderRadius: 10 }}
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
              style={{ padding: 10, minWidth: 280 }}
            >
              <option value="">Edit Existing Conversation</option>
              {conversations.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.title} ({c.slug})
                </option>
              ))}
            </select>
          </div>

          <form onSubmit={handleSaveConversation} style={{ display: "grid", gap: 16 }}>
            <section
              style={{
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 16,
                padding: 16
              }}
            >
              <h2 style={{ marginTop: 0 }}>Conversation Setup</h2>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <label>
                  <div>Primary Song</div>
                  <select
                    value={primarySongSlug}
                    onChange={(e) => handlePrimarySongChange(e.target.value)}
                    style={{ width: "100%", padding: 12 }}
                  >
                    <option value="">Choose the main song for this thread</option>
                    {songs.map((song) => (
                      <option key={song.slug} value={song.slug}>
                        {song.title} ({song.slug})
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <div>Conversation Title</div>
                  <input
                    value={conversationTitle}
                    onChange={(e) => setConversationTitle(e.target.value)}
                    placeholder="Conversation title, e.g. iMax"
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
                  <div>Conversation Slug</div>
                  <input
                    value={conversationSlug}
                    onChange={(e) => setConversationSlug(slugify(e.target.value))}
                    placeholder="Auto route, e.g. imax"
                    style={{ width: "100%", padding: 12 }}
                  />
                </label>

                <label>
                  <div>Inbox Preview</div>
                  <input
                    value={listPreview}
                    onChange={(e) => setListPreview(e.target.value)}
                    placeholder="What shows in the inbox preview"
                    style={{ width: "100%", padding: 12 }}
                  />
                </label>
              </div>

              <div style={{ marginTop: 16, maxWidth: 220 }}>
                <label>
                  <div>Sort Order</div>
                  <input
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value)}
                    type="number"
                    placeholder="1 = top"
                    style={{ width: "100%", padding: 12 }}
                  />
                </label>
              </div>
            </section>

            <section
              style={{
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 16,
                padding: 16
              }}
            >
              <div
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
              >
                <div>
                  <h2 style={{ margin: 0 }}>Messages</h2>
                  <p style={{ margin: "6px 0 0", opacity: 0.7 }}>
                    Timestamps only need timestamp text. Audio entries can preview and trim visually.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const next = EMPTY_MESSAGE();
                    next.senderName = "Caliph";
                    next.messageSide = "outgoing";
                    if (primarySongSlug) {
                      next.audioSourceSlug = primarySongSlug;
                    }
                    setMessages((prev) => [...prev, next]);
                  }}
                >
                  Add Message
                </button>
              </div>

              <div style={{ display: "grid", gap: 16, marginTop: 16 }}>
                {messages.map((msg, index) => {
                  const selectedSource =
                    audioSourceOptions.find((source) => source.slug === msg.audioSourceSlug) ||
                    null;

                  return (
                    <div
                      key={msg.clientId}
                      style={{
                        border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: 12,
                        padding: 12
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: 12
                        }}
                      >
                        <strong>Message {index + 1}</strong>
                        <button type="button" onClick={() => removeMessage(msg.clientId)}>
                          Remove
                        </button>
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns:
                            msg.messageType === "timestamp"
                              ? "180px 1fr"
                              : "180px 180px 1fr",
                          gap: 12
                        }}
                      >
                        <label>
                          <div>Type</div>
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
                            style={{ width: "100%", padding: 10 }}
                          >
                            <option value="text">Text</option>
                            <option value="audio">Audio</option>
                            <option value="timestamp">Timestamp</option>
                          </select>
                        </label>

                        {msg.messageType !== "timestamp" ? (
                          <label>
                            <div>Sender</div>
                            <select
                              value={msg.senderName}
                              onChange={(e) => {
                                const sender = e.target.value;
                                updateMessage(msg.clientId, {
                                  senderName: sender,
                                  messageSide: sender === "Caliph" ? "outgoing" : "incoming"
                                });
                              }}
                              style={{ width: "100%", padding: 10 }}
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
                          <label style={{ gridColumn: "2 / 3" }}>
                            <div>Timestamp Text</div>
                            <input
                              value={msg.body}
                              onChange={(e) =>
                                updateMessage(msg.clientId, { body: e.target.value })
                              }
                              placeholder="e.g. Today 7:15 PM"
                              style={{ width: "100%", padding: 10 }}
                            />
                          </label>
                        ) : msg.messageType === "text" ? (
                          <label style={{ gridColumn: "3 / 4" }}>
                            <div>Message</div>
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
                              style={{ width: "100%", padding: 10 }}
                            />
                          </label>
                        ) : (
                          <div />
                        )}
                      </div>

                      {msg.messageType === "audio" ? (
                        <>
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "1fr 220px 180px",
                              gap: 12,
                              marginTop: 12
                            }}
                          >
                            <label>
                              <div>Audio Source</div>
                              <select
                                value={msg.audioSourceSlug}
                                onChange={(e) =>
                                  updateMessage(msg.clientId, {
                                    audioSourceSlug: e.target.value
                                  })
                                }
                                style={{ width: "100%", padding: 10 }}
                              >
                                <option value="">Choose audio source</option>
                                {audioSourceOptions.map((source) => (
                                  <option key={source.slug} value={source.slug}>
                                    {source.label}
                                  </option>
                                ))}
                              </select>
                            </label>

                            <label>
                              <div>Bubble Label</div>
                              <input
                                value={msg.audioLabel}
                                onChange={(e) =>
                                  updateMessage(msg.clientId, {
                                    audioLabel: e.target.value
                                  })
                                }
                                placeholder="e.g. Main, Open Verse, Demo"
                                style={{ width: "100%", padding: 10 }}
                              />
                            </label>

                            <label>
                              <div>Kind</div>
                              <select
                                value={msg.audioKind}
                                onChange={(e) =>
                                  updateMessage(msg.clientId, {
                                    audioKind: e.target.value
                                  })
                                }
                                style={{ width: "100%", padding: 10 }}
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

            <section
              style={{
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 16,
                padding: 16
              }}
            >
              <div
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
              >
                <div>
                  <h2 style={{ margin: 0 }}>Alternate Versions (Optional)</h2>
                  <p style={{ margin: "6px 0 0", opacity: 0.7 }}>
                    Skip this if you only want to use the main song.
                  </p>
                </div>

                <div style={{ display: "flex", gap: 10 }}>
                  <button type="button" onClick={() => setAssetsOpen((prev) => !prev)}>
                    {assetsOpen ? "Hide" : "Show"}
                  </button>
                  {assetsOpen ? (
                    <button
                      type="button"
                      onClick={() => setAssets((prev) => [...prev, EMPTY_ASSET()])}
                    >
                      Add Version
                    </button>
                  ) : null}
                </div>
              </div>

              {assetsOpen ? (
                <div style={{ display: "grid", gap: 16, marginTop: 16 }}>
                  {!assets.length ? (
                    <p style={{ opacity: 0.7, margin: 0 }}>No alternate versions added.</p>
                  ) : null}

                  {assets.map((asset) => (
                    <div
                      key={asset.clientId}
                      style={{
                        border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: 12,
                        padding: 12
                      }}
                    >
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr auto",
                          gap: 12
                        }}
                      >
                        <label>
                          <div>Version Title</div>
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
                            style={{ width: "100%", padding: 10 }}
                          />
                        </label>

                        <label>
                          <div>Version Slug</div>
                          <input
                            value={asset.slug}
                            onChange={(e) =>
                              updateAsset(asset.clientId, {
                                slug: slugify(e.target.value)
                              })
                            }
                            placeholder="auto-generated from title"
                            style={{ width: "100%", padding: 10 }}
                          />
                        </label>

                        <button type="button" onClick={() => removeAsset(asset.clientId)}>
                          Remove
                        </button>
                      </div>

                      <div style={{ marginTop: 12 }}>
                        <input
                          type="file"
                          accept="audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/mp4,audio/aac"
                          onChange={(e) =>
                            updateAsset(asset.clientId, {
                              file: e.target.files?.[0] || null
                            })
                          }
                        />
                        {asset.file ? (
                          <div style={{ marginTop: 6, opacity: 0.7 }}>{asset.file.name}</div>
                        ) : asset.existingAudioUrl ? (
                          <div style={{ marginTop: 6, opacity: 0.7 }}>
                            Existing audio attached
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </section>

            <button type="submit" disabled={saving} style={{ padding: 14, borderRadius: 12 }}>
              {saving ? "Saving..." : "Save Conversation"}
            </button>
          </form>

          {result ? <p style={{ marginTop: 20 }}>{result}</p> : null}
        </>
      )}
    </main>
  );
}