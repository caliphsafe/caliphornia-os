import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "-");
}

export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get("mode");

  if (mode === "songs") {
    const { data, error } = await supabaseAdmin
      .from("songs")
      .select("slug, title, artist_name, audio_path, description, source_app_slug")
      .eq("source_app_slug", "friends")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      songs: data || []
    });
  }

  if (mode === "conversations") {
    const { data, error } = await supabaseAdmin
      .from("conversations")
      .select("slug, title")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      conversations: data || []
    });
  }

  if (mode === "conversation-detail") {
    const slug = request.nextUrl.searchParams.get("slug");

    if (!slug) {
      return NextResponse.json({ ok: false, error: "Missing slug." }, { status: 400 });
    }

    const { data: conversation, error: conversationError } = await supabaseAdmin
      .from("conversations")
      .select(`
        id,
        slug,
        title,
        subtitle,
        list_preview,
        avatar_letter,
        last_activity_label,
        sort_order,
        primary_song_id
      `)
      .eq("slug", slug)
      .single();

    if (conversationError || !conversation) {
      return NextResponse.json(
        { ok: false, error: conversationError?.message || "Conversation not found." },
        { status: 404 }
      );
    }

    let primarySongSlug: string | null = null;

    if (conversation.primary_song_id) {
      const { data: song } = await supabaseAdmin
        .from("songs")
        .select("slug")
        .eq("id", conversation.primary_song_id)
        .maybeSingle();

      primarySongSlug = song?.slug || null;
    }

    const { data: assets } = await supabaseAdmin
      .from("audio_assets")
      .select(`
        id,
        slug,
        title,
        version_label,
        is_final_version,
        is_playlistable,
        linked_song_id
      `)
      .eq("conversation_id", conversation.id)
      .eq("is_final_version", false)
      .order("created_at", { ascending: true });

    const linkedSongIds = Array.from(
      new Set((assets || []).map((a) => a.linked_song_id).filter(Boolean))
    );

    const linkedSongMap = new Map<string, string>();

    if (linkedSongIds.length) {
      const { data: linkedSongs } = await supabaseAdmin
        .from("songs")
        .select("id, slug")
        .in("id", linkedSongIds);

      for (const row of linkedSongs || []) {
        linkedSongMap.set(row.id, row.slug);
      }
    }

    const { data: messages } = await supabaseAdmin
      .from("conversation_messages")
      .select(`
        id,
        message_type,
        sender_name,
        sender_label,
        body,
        position,
        message_side,
        display_time,
        audio_label,
        audio_kind,
        message_audio_clips (
          clip_title,
          start_seconds,
          end_seconds,
          display_duration,
          audio_assets (
            slug
          )
        )
      `)
      .eq("conversation_id", conversation.id)
      .order("position", { ascending: true });

    const normalizedMessages = (messages || []).map((m: any) => {
      const clip = Array.isArray(m.message_audio_clips) ? m.message_audio_clips[0] : null;
      const clipAsset = clip?.audio_assets
        ? (Array.isArray(clip.audio_assets) ? clip.audio_assets[0] : clip.audio_assets)
        : null;

      return {
        message_type: m.message_type,
        sender_name: m.sender_name,
        sender_label: m.sender_label,
        body: m.body,
        message_side: m.message_side,
        display_time: m.display_time,
        audio_label: m.audio_label,
        audio_kind: m.audio_kind,
        asset_slug: clipAsset?.slug || "",
        clip_title: clip?.clip_title || "",
        start_seconds: clip?.start_seconds ?? null,
        end_seconds: clip?.end_seconds ?? null,
        display_duration: clip?.display_duration || ""
      };
    });

    return NextResponse.json({
      ok: true,
      detail: {
        conversation,
        primarySongSlug,
        assets: (assets || []).map((a) => ({
          slug: a.slug,
          title: a.title,
          version_label: a.version_label,
          is_playlistable: a.is_playlistable,
          linked_song_slug: a.linked_song_id ? linkedSongMap.get(a.linked_song_id) || "" : ""
        })),
        messages: normalizedMessages
      }
    });
  }

  if (mode === "app-order") {
    const appSlug = request.nextUrl.searchParams.get("appSlug");

    if (!appSlug) {
      return NextResponse.json({ ok: false, error: "Missing appSlug." }, { status: 400 });
    }

    const { data: app } = await supabaseAdmin
      .from("apps")
      .select("id")
      .eq("slug", appSlug)
      .single();

    if (!app) {
      return NextResponse.json({ ok: false, error: "App not found." }, { status: 404 });
    }

    const { data, error } = await supabaseAdmin
      .from("app_songs")
      .select(`
        position,
        song_slug,
        songs (
          title
        )
      `)
      .eq("app_id", app.id)
      .order("position", { ascending: true });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      rows: (data || []).map((row: any) => ({
        song_slug: row.song_slug,
        title: Array.isArray(row.songs) ? row.songs[0]?.title || row.song_slug : row.songs?.title || row.song_slug,
        position: row.position
      }))
    });
  }

  return NextResponse.json({ ok: false, error: "Invalid mode." }, { status: 400 });
}

export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const body = await request.json();

    if (body.action === "save-order") {
      const { appSlug, rows } = body;

      const { data: app } = await supabaseAdmin
        .from("apps")
        .select("id")
        .eq("slug", appSlug)
        .single();

      if (!app) {
        return NextResponse.json({ ok: false, error: "App not found." }, { status: 404 });
      }

      for (const row of rows || []) {
        const { error } = await supabaseAdmin
          .from("app_songs")
          .update({ position: row.position })
          .eq("app_id", app.id)
          .eq("song_slug", row.songSlug);

        if (error) {
          return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
        }
      }

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: false, error: "Invalid action." }, { status: 400 });
  }

  try {
    const formData = await request.formData();
    const action = String(formData.get("action") || "");

    if (action !== "save-conversation") {
      return NextResponse.json({ ok: false, error: "Invalid action." }, { status: 400 });
    }

    const selectedConversationSlug = String(formData.get("selectedConversationSlug") || "").trim();
    const primarySongSlug = String(formData.get("primarySongSlug") || "").trim();
    const conversationSlug = slugify(String(formData.get("conversationSlug") || "").trim());
    const conversationTitle = String(formData.get("conversationTitle") || "").trim();
    const conversationSubtitle = String(formData.get("conversationSubtitle") || "").trim();
    const listPreview = String(formData.get("listPreview") || "").trim();
    const avatarLetter = String(formData.get("avatarLetter") || "").trim();
    const lastActivityLabel = String(formData.get("lastActivityLabel") || "").trim();
    const sortOrder = String(formData.get("sortOrder") || "").trim();

    const assets = JSON.parse(String(formData.get("assets") || "[]"));
    const messages = JSON.parse(String(formData.get("messages") || "[]"));

    if (!primarySongSlug || !conversationSlug || !conversationTitle) {
      return NextResponse.json(
        { ok: false, error: "Missing required conversation fields." },
        { status: 400 }
      );
    }

    const { data: appRow } = await supabaseAdmin
      .from("apps")
      .select("id, slug")
      .eq("slug", "friends")
      .single();

    if (!appRow) {
      return NextResponse.json({ ok: false, error: "Friends app not found." }, { status: 404 });
    }

    const { data: primarySong } = await supabaseAdmin
      .from("songs")
      .select("id, slug, title, artist_name, audio_path, cover_image_path")
      .eq("slug", primarySongSlug)
      .single();

    if (!primarySong) {
      return NextResponse.json({ ok: false, error: "Primary song not found." }, { status: 404 });
    }

    const { data: savedConversation, error: conversationError } = await supabaseAdmin
      .from("conversations")
      .upsert(
        {
          app_id: appRow.id,
          slug: conversationSlug,
          title: conversationTitle,
          subtitle: conversationSubtitle || primarySong.artist_name || "",
          is_published: true,
          avatar_letter: (avatarLetter || conversationTitle[0] || "F").slice(0, 1),
          list_preview: listPreview || null,
          last_activity_label: lastActivityLabel || null,
          sort_order: sortOrder ? Number(sortOrder) : null,
          cover_image_path: primarySong.cover_image_path || null,
          cover_image_bucket: "cover-art",
          primary_song_id: primarySong.id
        },
        { onConflict: "slug" }
      )
      .select("id, slug, title")
      .single();

    if (conversationError || !savedConversation) {
      return NextResponse.json(
        { ok: false, error: conversationError?.message || "Could not save conversation." },
        { status: 500 }
      );
    }

    // Ensure final asset exists and is correct
    const { data: existingFinalAsset } = await supabaseAdmin
      .from("audio_assets")
      .select("id")
      .eq("conversation_id", savedConversation.id)
      .eq("is_final_version", true)
      .maybeSingle();

    if (existingFinalAsset?.id) {
      const { error } = await supabaseAdmin
        .from("audio_assets")
        .update({
          slug: primarySong.slug,
          title: primarySong.title,
          storage_path: primarySong.audio_path,
          version_label: "Final",
          is_final_version: true,
          is_playlistable: true,
          linked_song_id: primarySong.id
        })
        .eq("id", existingFinalAsset.id);

      if (error) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      }
    } else {
      const { error } = await supabaseAdmin
        .from("audio_assets")
        .insert({
          conversation_id: savedConversation.id,
          slug: primarySong.slug,
          title: primarySong.title,
          storage_path: primarySong.audio_path,
          version_label: "Final",
          is_final_version: true,
          is_playlistable: true,
          linked_song_id: primarySong.id
        });

      if (error) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      }
    }

    // Wipe old non-final content for clean rebuild
    const { data: oldMessages } = await supabaseAdmin
      .from("conversation_messages")
      .select("id")
      .eq("conversation_id", savedConversation.id);

    const oldMessageIds = (oldMessages || []).map((m) => m.id);

    if (oldMessageIds.length) {
      await supabaseAdmin.from("message_audio_clips").delete().in("message_id", oldMessageIds);
      await supabaseAdmin.from("conversation_messages").delete().in("id", oldMessageIds);
    }

    await supabaseAdmin
      .from("audio_assets")
      .delete()
      .eq("conversation_id", savedConversation.id)
      .eq("is_final_version", false);

    // Create extra assets
    const assetSlugToId = new Map<string, string>();

    for (const asset of assets || []) {
      let linkedSongId: string | null = null;

      if (asset.linkedSongSlug) {
        const { data: linkedSong } = await supabaseAdmin
          .from("songs")
          .select("id")
          .eq("slug", asset.linkedSongSlug)
          .maybeSingle();

        linkedSongId = linkedSong?.id || null;
      }

      let storagePath: string | null = null;
      const incomingFile = formData.get(`assetFile__${asset.clientId}`);

      if (incomingFile instanceof File && incomingFile.size > 0) {
        const ext = (incomingFile.name.split(".").pop() || "mp3").toLowerCase();
        storagePath = `friends/${primarySong.slug}/${asset.slug}.${safeFileName(ext)}`;

        const upload = await supabaseAdmin.storage
          .from("songs")
          .upload(storagePath, incomingFile, {
            upsert: true,
            contentType: incomingFile.type || undefined
          });

        if (upload.error) {
          return NextResponse.json({ ok: false, error: upload.error.message }, { status: 500 });
        }
      }

      const { data: savedAsset, error: assetError } = await supabaseAdmin
        .from("audio_assets")
        .upsert(
          {
            conversation_id: savedConversation.id,
            slug: asset.slug,
            title: asset.title || asset.slug,
            storage_path: storagePath,
            version_label: asset.versionLabel || null,
            is_final_version: false,
            is_playlistable: Boolean(asset.isPlaylistable),
            linked_song_id: linkedSongId
          },
          { onConflict: "conversation_id,slug" }
        )
        .select("id, slug")
        .single();

      if (assetError || !savedAsset) {
        return NextResponse.json(
          { ok: false, error: assetError?.message || "Could not save asset." },
          { status: 500 }
        );
      }

      assetSlugToId.set(savedAsset.slug, savedAsset.id);
    }

    // Add final asset mapping too for audio messages if needed
    const { data: finalAsset } = await supabaseAdmin
      .from("audio_assets")
      .select("id, slug")
      .eq("conversation_id", savedConversation.id)
      .eq("is_final_version", true)
      .single();

    if (finalAsset?.slug) {
      assetSlugToId.set(finalAsset.slug, finalAsset.id);
    }

    // Create messages + clips
    for (const msg of messages || []) {
      const { data: savedMessage, error: messageError } = await supabaseAdmin
        .from("conversation_messages")
        .insert({
          conversation_id: savedConversation.id,
          message_type: msg.messageType,
          sender_name: msg.senderName || null,
          sender_label: msg.senderLabel || null,
          body: msg.body || null,
          position: msg.position,
          is_published: true,
          message_side: msg.messageSide || null,
          display_time: msg.displayTime || null,
          audio_label: msg.audioLabel || null,
          audio_kind: msg.audioKind || null
        })
        .select("id")
        .single();

      if (messageError || !savedMessage) {
        return NextResponse.json(
          { ok: false, error: messageError?.message || "Could not save message." },
          { status: 500 }
        );
      }

      if (msg.messageType === "audio" && msg.assetSlug) {
        const audioAssetId = assetSlugToId.get(msg.assetSlug);

        if (!audioAssetId) {
          return NextResponse.json(
            { ok: false, error: `Audio asset "${msg.assetSlug}" not found for one of the messages.` },
            { status: 400 }
          );
        }

        const { error: clipError } = await supabaseAdmin
          .from("message_audio_clips")
          .insert({
            message_id: savedMessage.id,
            audio_asset_id: audioAssetId,
            clip_title: msg.clipTitle || msg.audioLabel || null,
            start_seconds: msg.startSeconds ? Number(msg.startSeconds) : 0,
            end_seconds: msg.endSeconds ? Number(msg.endSeconds) : null,
            display_duration: msg.displayDuration || null
          });

        if (clipError) {
          return NextResponse.json(
            { ok: false, error: clipError.message },
            { status: 500 }
          );
        }
      }
    }

    return NextResponse.json({
      ok: true,
      conversation: savedConversation
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Server error." },
      { status: 500 }
    );
  }
}
