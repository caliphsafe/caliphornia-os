"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type SongOption = {
  slug: string;
  title: string;
  artist_name: string | null;
  audio_path: string | null;
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
  versionLabel: string;
  isPlaylistable: boolean;
  linkedSongSlug: string;
  file: File | null;
};

type MessageRow = {
  clientId: string;
  messageType: "timestamp" | "text" | "audio";
  senderName: string;
  senderLabel: string;
  body: string;
  messageSide: "incoming" | "outgoing" | "center";
  displayTime: string;
  audioLabel: string;
  audioKind: string;
  assetSlug: string;
  clipTitle: string;
  startSeconds: string;
  endSeconds: string;
  displayDuration: string;
};

type AppOrderRow = {
  song_slug: string;
  title: string;
  position: number | null;
};

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

const EMPTY_MESSAGE = (): MessageRow => ({
  clientId: uid(),
  messageType: "text",
  senderName: "",
  senderLabel: "",
  body: "",
  messageSide: "incoming",
  displayTime: "",
  audioLabel: "",
  audioKind: "Voice note",
  assetSlug: "",
  clipTitle: "",
  startSeconds: "",
  endSeconds: "",
  displayDuration: ""
});

const EMPTY_ASSET = (): AssetRow => ({
  clientId: uid(),
  slug: "",
  title: "",
  versionLabel: "",
  isPlaylistable: false,
  linkedSongSlug: "",
  file: null
});

export default function FriendsBuilderPage() {
  const [songs, setSongs] = useState<SongOption[]>([]);
  const [conversations, setConversations] = useState<ConversationOption[]>([]);
  const [selectedConversationSlug, setSelectedConversationSlug] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState("");

  const [primarySongSlug, setPrimarySongSlug] = useState("");
  const [conversationSlug, setConversationSlug] = useState("");
  const [conversationTitle, setConversationTitle] = useState("");
  const [conversationSubtitle, setConversationSubtitle] = useState("");
  const [listPreview, setListPreview] = useState("");
  const [avatarLetter, setAvatarLetter] = useState("");
  const [lastActivityLabel, setLastActivityLabel] = useState("");
  const [sortOrder, setSortOrder] = useState("");

  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [messages, setMessages] = useState<MessageRow[]>([]);

  const [orderAppSlug, setOrderAppSlug] = useState("friends");
  const [orderRows, setOrderRows] = useState<AppOrderRow[]>([]);
  const [savingOrder, setSavingOrder] = useState(false);

  const selectedSong = useMemo(
    () => songs.find((s) => s.slug === primarySongSlug) || null,
    [songs, primarySongSlug]
  );

  async function loadBoot() {
    setLoading(true);
    setResult("");
    try {
      const [songsRes, convosRes, orderRes] = await Promise.all([
        fetch("/api/dashboard/friends-builder?mode=songs", { cache: "no-store" }),
        fetch("/api/dashboard/friends-builder?mode=conversations", { cache: "no-store" }),
        fetch("/api/dashboard/friends-builder?mode=app-order&appSlug=friends", { cache: "no-store" })
      ]);

      const songsData = await songsRes.json();
      const convosData = await convosRes.json();
      const orderData = await orderRes.json();

      if (songsData?.ok) setSongs(songsData.songs || []);
      if (convosData?.ok) setConversations(convosData.conversations || []);
      if (orderData?.ok) setOrderRows(orderData.rows || []);
    } catch {
      setResult("Could not load builder data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBoot();
  }, []);

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
      setConversationSubtitle(detail.conversation.subtitle || "");
      setListPreview(detail.conversation.list_preview || "");
      setAvatarLetter(detail.conversation.avatar_letter || "");
      setLastActivityLabel(detail.conversation.last_activity_label || "");
      setSortOrder(
        detail.conversation.sort_order !== null && detail.conversation.sort_order !== undefined
          ? String(detail.conversation.sort_order)
          : ""
      );

      setAssets(
        (detail.assets || []).map((a: any) => ({
          clientId: uid(),
          slug: a.slug || "",
          title: a.title || "",
          versionLabel: a.version_label || "",
          isPlaylistable: Boolean(a.is_playlistable),
          linkedSongSlug: a.linked_song_slug || "",
          file: null
        }))
      );

      setMessages(
        (detail.messages || []).map((m: any) => ({
          clientId: uid(),
          messageType: m.message_type,
          senderName: m.sender_name || "",
          senderLabel: m.sender_label || "",
          body: m.body || "",
          messageSide: m.message_side || "incoming",
          displayTime: m.display_time || "",
          audioLabel: m.audio_label || "",
          audioKind: m.audio_kind || "Voice note",
          assetSlug: m.asset_slug || "",
          clipTitle: m.clip_title || "",
          startSeconds:
            m.start_seconds !== null && m.start_seconds !== undefined ? String(m.start_seconds) : "",
          endSeconds:
            m.end_seconds !== null && m.end_seconds !== undefined ? String(m.end_seconds) : "",
          displayDuration: m.display_duration || ""
        }))
      );
    } catch {
      setResult("Could not load conversation.");
    }
  }

  async function loadAppOrder(appSlug: string) {
    try {
      const res = await fetch(
        `/api/dashboard/friends-builder?mode=app-order&appSlug=${encodeURIComponent(appSlug)}`,
        { cache: "no-store" }
      );
      const data = await res.json();
      if (data?.ok) {
        setOrderRows(data.rows || []);
      }
    } catch {
      setResult("Could not load app order.");
    }
  }

  function resetBuilder() {
    setSelectedConversationSlug("");
    setPrimarySongSlug("");
    setConversationSlug("");
    setConversationTitle("");
    setConversationSubtitle("");
    setListPreview("");
    setAvatarLetter("");
    setLastActivityLabel("");
    setSortOrder("");
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
      prev.map((row) => (row.clientId === clientId ? { ...row, ...patch } : row))
    );
  }

  function removeAsset(clientId: string) {
    setAssets((prev) => prev.filter((row) => row.clientId !== clientId));
  }

  function removeMessage(clientId: string) {
    setMessages((prev) => prev.filter((row) => row.clientId !== clientId));
  }

  async function handleSaveConversation(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setResult("");

    try {
      if (!primarySongSlug || !conversationSlug || !conversationTitle) {
        setResult("Primary song, conversation slug, and conversation title are required.");
        setSaving(false);
        return;
      }

      const payload = new FormData();
      payload.append("action", "save-conversation");
      payload.append("selectedConversationSlug", selectedConversationSlug);
      payload.append("primarySongSlug", primarySongSlug);
      payload.append("conversationSlug", conversationSlug);
      payload.append("conversationTitle", conversationTitle);
      payload.append("conversationSubtitle", conversationSubtitle);
      payload.append("listPreview", listPreview);
      payload.append("avatarLetter", avatarLetter);
      payload.append("lastActivityLabel", lastActivityLabel);
      payload.append("sortOrder", sortOrder);

      payload.append(
        "assets",
        JSON.stringify(
          assets.map((a) => ({
            clientId: a.clientId,
            slug: a.slug,
            title: a.title,
            versionLabel: a.versionLabel,
            isPlaylistable: a.isPlaylistable,
            linkedSongSlug: a.linkedSongSlug
          }))
        )
      );

      payload.append(
        "messages",
        JSON.stringify(
          messages.map((m, index) => ({
            position: index + 1,
            messageType: m.messageType,
            senderName: m.senderName,
            senderLabel: m.senderLabel,
            body: m.body,
            messageSide: m.messageSide,
            displayTime: m.displayTime,
            audioLabel: m.audioLabel,
            audioKind: m.audioKind,
            assetSlug: m.assetSlug,
            clipTitle: m.clipTitle,
            startSeconds: m.startSeconds,
            endSeconds: m.endSeconds,
            displayDuration: m.displayDuration
          }))
        )
      );

      for (const asset of assets) {
        if (asset.file) {
          payload.append(`assetFile__${asset.clientId}`, asset.file);
        }
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
      setSelectedConversationSlug(data.conversation?.slug || conversationSlug);
    } catch {
      setResult("Server error while saving conversation.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveOrder() {
    setSavingOrder(true);
    setResult("");

    try {
      const res = await fetch("/api/dashboard/friends-builder", {
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
      <h1 style={{ marginBottom: 8 }}>Fri.ends Conversation Builder</h1>
      <p style={{ marginTop: 0, marginBottom: 24, opacity: 0.75 }}>
        Build full Fri.ends conversations and manage song order for your apps.
      </p>

      {loading ? (
        <p>Loading…</p>
      ) : (
        <>
          <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
            <button type="button" onClick={resetBuilder} style={{ padding: "10px 14px", borderRadius: 10 }}>
              New Conversation
            </button>

            <select
              value={selectedConversationSlug}
              onChange={(e) => {
                const slug = e.target.value;
                setSelectedConversationSlug(slug);
                if (slug) loadConversation(slug);
              }}
              style={{ padding: 10, minWidth: 260 }}
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
            <section style={{ border: "1px solid rgba(255,255,255,0.12)", borderRadius: 16, padding: 16 }}>
              <h2 style={{ marginTop: 0 }}>Conversation Basics</h2>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <label>
                  <div>Primary Song</div>
                  <select
                    value={primarySongSlug}
                    onChange={(e) => {
                      const slug = e.target.value;
                      setPrimarySongSlug(slug);
                      const song = songs.find((s) => s.slug === slug);
                      if (song) {
                        if (!conversationSlug) setConversationSlug(song.slug);
                        if (!conversationTitle) setConversationTitle(song.title);
                        if (!conversationSubtitle) setConversationSubtitle(song.artist_name || "");
                        if (!listPreview) setListPreview(song.description || "");
                        if (!avatarLetter) setAvatarLetter((song.title?.[0] || "F").toUpperCase());
                      }
                    }}
                    style={{ width: "100%", padding: 12 }}
                  >
                    <option value="">Choose a song</option>
                    {songs.map((song) => (
                      <option key={song.slug} value={song.slug}>
                        {song.title} ({song.slug})
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <div>Conversation Slug</div>
                  <input
                    value={conversationSlug}
                    onChange={(e) => setConversationSlug(e.target.value)}
                    style={{ width: "100%", padding: 12 }}
                  />
                </label>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
                <label>
                  <div>Conversation Title</div>
                  <input
                    value={conversationTitle}
                    onChange={(e) => setConversationTitle(e.target.value)}
                    style={{ width: "100%", padding: 12 }}
                  />
                </label>

                <label>
                  <div>Subtitle</div>
                  <input
                    value={conversationSubtitle}
                    onChange={(e) => setConversationSubtitle(e.target.value)}
                    style={{ width: "100%", padding: 12 }}
                  />
                </label>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 16, marginTop: 16 }}>
                <label>
                  <div>List Preview</div>
                  <input
                    value={listPreview}
                    onChange={(e) => setListPreview(e.target.value)}
                    style={{ width: "100%", padding: 12 }}
                  />
                </label>

                <label>
                  <div>Avatar Letter</div>
                  <input
                    value={avatarLetter}
                    onChange={(e) => setAvatarLetter(e.target.value.slice(0, 1))}
                    maxLength={1}
                    style={{ width: "100%", padding: 12 }}
                  />
                </label>

                <label>
                  <div>Last Activity</div>
                  <input
                    value={lastActivityLabel}
                    onChange={(e) => setLastActivityLabel(e.target.value)}
                    style={{ width: "100%", padding: 12 }}
                  />
                </label>

                <label>
                  <div>Sort Order</div>
                  <input
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value)}
                    type="number"
                    style={{ width: "100%", padding: 12 }}
                  />
                </label>
              </div>
            </section>

            <section style={{ border: "1px solid rgba(255,255,255,0.12)", borderRadius: 16, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h2 style={{ marginTop: 0 }}>Additional Audio Assets</h2>
                <button type="button" onClick={() => setAssets((prev) => [...prev, EMPTY_ASSET()])}>
                  Add Asset
                </button>
              </div>

              {!assets.length ? <p style={{ opacity: 0.7 }}>No extra assets yet.</p> : null}

              <div style={{ display: "grid", gap: 16 }}>
                {assets.map((asset) => (
                  <div
                    key={asset.clientId}
                    style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 12 }}
                  >
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                      <label>
                        <div>Asset Slug</div>
                        <input
                          value={asset.slug}
                          onChange={(e) => updateAsset(asset.clientId, { slug: e.target.value })}
                          style={{ width: "100%", padding: 10 }}
                        />
                      </label>

                      <label>
                        <div>Title</div>
                        <input
                          value={asset.title}
                          onChange={(e) => updateAsset(asset.clientId, { title: e.target.value })}
                          style={{ width: "100%", padding: 10 }}
                        />
                      </label>

                      <label>
                        <div>Version Label</div>
                        <input
                          value={asset.versionLabel}
                          onChange={(e) => updateAsset(asset.clientId, { versionLabel: e.target.value })}
                          placeholder="Demo / Open Verse / Main"
                          style={{ width: "100%", padding: 10 }}
                        />
                      </label>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 12, marginTop: 12 }}>
                      <label>
                        <div>Linked Song Slug (optional)</div>
                        <input
                          value={asset.linkedSongSlug}
                          onChange={(e) => updateAsset(asset.clientId, { linkedSongSlug: e.target.value })}
                          style={{ width: "100%", padding: 10 }}
                        />
                      </label>

                      <label style={{ display: "flex", alignItems: "end", gap: 8 }}>
                        <input
                          type="checkbox"
                          checked={asset.isPlaylistable}
                          onChange={(e) => updateAsset(asset.clientId, { isPlaylistable: e.target.checked })}
                        />
                        Playlistable
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
                          updateAsset(asset.clientId, { file: e.target.files?.[0] || null })
                        }
                      />
                      {asset.file ? <div style={{ marginTop: 6, opacity: 0.7 }}>{asset.file.name}</div> : null}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section style={{ border: "1px solid rgba(255,255,255,0.12)", borderRadius: 16, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h2 style={{ marginTop: 0 }}>Messages</h2>
                <button type="button" onClick={() => setMessages((prev) => [...prev, EMPTY_MESSAGE()])}>
                  Add Message
                </button>
              </div>

              <div style={{ display: "grid", gap: 16 }}>
                {messages.map((msg, index) => (
                  <div
                    key={msg.clientId}
                    style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 12 }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <strong>Message {index + 1}</strong>
                      <button type="button" onClick={() => removeMessage(msg.clientId)}>
                        Remove
                      </button>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                      <label>
                        <div>Type</div>
                        <select
                          value={msg.messageType}
                          onChange={(e) =>
                            updateMessage(msg.clientId, {
                              messageType: e.target.value as MessageRow["messageType"]
                            })
                          }
                          style={{ width: "100%", padding: 10 }}
                        >
                          <option value="text">Text</option>
                          <option value="timestamp">Timestamp</option>
                          <option value="audio">Audio</option>
                        </select>
                      </label>

                      <label>
                        <div>Side</div>
                        <select
                          value={msg.messageSide}
                          onChange={(e) =>
                            updateMessage(msg.clientId, {
                              messageSide: e.target.value as MessageRow["messageSide"]
                            })
                          }
                          style={{ width: "100%", padding: 10 }}
                        >
                          <option value="incoming">Incoming</option>
                          <option value="outgoing">Outgoing</option>
                          <option value="center">Center</option>
                        </select>
                      </label>

                      <label>
                        <div>Display Time</div>
                        <input
                          value={msg.displayTime}
                          onChange={(e) => updateMessage(msg.clientId, { displayTime: e.target.value })}
                          style={{ width: "100%", padding: 10 }}
                        />
                      </label>
                    </div>

                    {msg.messageType === "timestamp" ? (
                      <div style={{ marginTop: 12 }}>
                        <label>
                          <div>Timestamp Text</div>
                          <input
                            value={msg.body}
                            onChange={(e) => updateMessage(msg.clientId, { body: e.target.value })}
                            style={{ width: "100%", padding: 10 }}
                          />
                        </label>
                      </div>
                    ) : null}

                    {msg.messageType === "text" ? (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
                        <label>
                          <div>Sender Name</div>
                          <input
                            value={msg.senderName}
                            onChange={(e) => updateMessage(msg.clientId, { senderName: e.target.value })}
                            style={{ width: "100%", padding: 10 }}
                          />
                        </label>

                        <label>
                          <div>Sender Label</div>
                          <input
                            value={msg.senderLabel}
                            onChange={(e) => updateMessage(msg.clientId, { senderLabel: e.target.value })}
                            style={{ width: "100%", padding: 10 }}
                          />
                        </label>

                        <label style={{ gridColumn: "1 / -1" }}>
                          <div>Body</div>
                          <textarea
                            value={msg.body}
                            onChange={(e) => updateMessage(msg.clientId, { body: e.target.value })}
                            rows={3}
                            style={{ width: "100%", padding: 10 }}
                          />
                        </label>
                      </div>
                    ) : null}

                    {msg.messageType === "audio" ? (
                      <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                          <label>
                            <div>Sender Name</div>
                            <input
                              value={msg.senderName}
                              onChange={(e) => updateMessage(msg.clientId, { senderName: e.target.value })}
                              style={{ width: "100%", padding: 10 }}
                            />
                          </label>

                          <label>
                            <div>Sender Label</div>
                            <input
                              value={msg.senderLabel}
                              onChange={(e) => updateMessage(msg.clientId, { senderLabel: e.target.value })}
                              style={{ width: "100%", padding: 10 }}
                            />
                          </label>

                          <label>
                            <div>Asset Slug</div>
                            <input
                              value={msg.assetSlug}
                              onChange={(e) => updateMessage(msg.clientId, { assetSlug: e.target.value })}
                              placeholder="Use one of the asset slugs above"
                              style={{ width: "100%", padding: 10 }}
                            />
                          </label>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                          <label>
                            <div>Audio Label</div>
                            <input
                              value={msg.audioLabel}
                              onChange={(e) => updateMessage(msg.clientId, { audioLabel: e.target.value })}
                              style={{ width: "100%", padding: 10 }}
                            />
                          </label>

                          <label>
                            <div>Audio Kind</div>
                            <input
                              value={msg.audioKind}
                              onChange={(e) => updateMessage(msg.clientId, { audioKind: e.target.value })}
                              style={{ width: "100%", padding: 10 }}
                            />
                          </label>

                          <label>
                            <div>Clip Title</div>
                            <input
                              value={msg.clipTitle}
                              onChange={(e) => updateMessage(msg.clientId, { clipTitle: e.target.value })}
                              style={{ width: "100%", padding: 10 }}
                            />
                          </label>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                          <label>
                            <div>Start Seconds</div>
                            <input
                              value={msg.startSeconds}
                              onChange={(e) => updateMessage(msg.clientId, { startSeconds: e.target.value })}
                              type="number"
                              step="0.01"
                              style={{ width: "100%", padding: 10 }}
                            />
                          </label>

                          <label>
                            <div>End Seconds</div>
                            <input
                              value={msg.endSeconds}
                              onChange={(e) => updateMessage(msg.clientId, { endSeconds: e.target.value })}
                              type="number"
                              step="0.01"
                              style={{ width: "100%", padding: 10 }}
                            />
                          </label>

                          <label>
                            <div>Display Duration</div>
                            <input
                              value={msg.displayDuration}
                              onChange={(e) => updateMessage(msg.clientId, { displayDuration: e.target.value })}
                              placeholder="0:26"
                              style={{ width: "100%", padding: 10 }}
                            />
                          </label>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>

            <button type="submit" disabled={saving} style={{ padding: 14, borderRadius: 12 }}>
              {saving ? "Saving…" : "Save Conversation"}
            </button>
          </form>

          <section
            style={{
              marginTop: 32,
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 16,
              padding: 16
            }}
          >
            <h2 style={{ marginTop: 0 }}>App Order Manager</h2>

            <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16 }}>
              <select
                value={orderAppSlug}
                onChange={async (e) => {
                  const next = e.target.value;
                  setOrderAppSlug(next);
                  await loadAppOrder(next);
                }}
                style={{ padding: 10 }}
              >
                <option value="friends">friends</option>
                <option value="fartherhood">fartherhood</option>
              </select>

              <button type="button" onClick={handleSaveOrder} disabled={savingOrder}>
                {savingOrder ? "Saving…" : "Save Order"}
              </button>
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              {orderRows.map((row, index) => (
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
                    {row.title} <span style={{ opacity: 0.6 }}>({row.song_slug})</span>
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
