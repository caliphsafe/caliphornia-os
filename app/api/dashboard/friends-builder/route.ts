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
        ? Array.isArray(clip.audio_assets)
          ? clip.audio_assets[0]
          : clip.audio_assets
        : null;

      return {
        message_type: m.message_type,
        message_side: m.message_side,
        body: m.body || "",
        audio_label: m.audio_label || "",
        audio_kind: m.audio_kind || "Song",
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
          title: a.title
        })),
        messages: normalizedMessages
      }
    });
  }

  return NextResponse.json({ ok: false, error: "Invalid mode." }, { status: 400 });
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const action = String(formData.get("action") || "");

    if (action !== "save-conversation") {
      return NextResponse.json({ ok: false, error: "Invalid action." }, { status: 400 });
    }

    const selectedConversationSlug = String(
      formData.get("selectedConversationSlug") || ""
    ).trim();

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

    const { data: appRow, error: appError } = await supabaseAdmin
      .from("apps")
      .select("id, slug")
      .eq("slug", "friends")
      .single();

    if (appError || !appRow) {
      return NextResponse.json(
        { ok: false, error: appError?.message || "Friends app not found." },
        { status: 404 }
      );
    }

    const { data: primarySong, error: primarySongError } = await supabaseAdmin
      .from("songs")
      .select("id, slug, title, artist_name, audio_path, cover_image_path")
      .eq("slug", primarySongSlug)
      .single();

    if (primarySongError || !primarySong) {
      return NextResponse.json(
        { ok: false, error: primarySongError?.message || "Primary song not found." },
        { status: 404 }
      );
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

    const assetSlugToId = new Map<string, string>();

       for (const asset of assets || []) {
      const cleanSlug = slugify(String(asset.slug || "").trim());
      const cleanTitle = String(asset.title || "").trim();

      if (!cleanSlug) continue;

      let storagePath: string | null = null;

      const uploadedMetaRaw = formData.get(`assetUpload__${asset.clientId}`);
      if (typeof uploadedMetaRaw === "string" && uploadedMetaRaw) {
        try {
          const uploadedMeta = JSON.parse(uploadedMetaRaw);
          if (uploadedMeta?.slug === cleanSlug && uploadedMeta?.storagePath) {
            storagePath = String(uploadedMeta.storagePath);
          }
        } catch {}
      }

      const { data: savedAsset, error: assetError } = await supabaseAdmin
        .from("audio_assets")
        .upsert(
          {
            conversation_id: savedConversation.id,
            slug: cleanSlug,
            title: cleanTitle || cleanSlug,
            storage_path: storagePath,
            version_label: null,
            is_final_version: false,
            is_playlistable: false,
            linked_song_id: null
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

    const { data: finalAsset } = await supabaseAdmin
      .from("audio_assets")
      .select("id, slug")
      .eq("conversation_id", savedConversation.id)
      .eq("is_final_version", true)
      .single();

    if (finalAsset?.slug) {
      assetSlugToId.set(finalAsset.slug, finalAsset.id);
    }

    for (const msg of messages || []) {
      const messageType = String(msg.messageType || "").trim();
      const messageSide =
        messageType === "timestamp"
          ? "center"
          : String(msg.messageSide || "incoming").trim();

      const body = String(msg.body || "").trim();
      const audioLabel = String(msg.audioLabel || "").trim();
      const audioKind = String(msg.audioKind || "Song").trim();
      const assetSlug = slugify(String(msg.assetSlug || "").trim());

      const { data: savedMessage, error: messageError } = await supabaseAdmin
        .from("conversation_messages")
        .insert({
          conversation_id: savedConversation.id,
          message_type: messageType,
          sender_name:
            messageType === "timestamp"
              ? null
              : messageSide === "outgoing"
              ? "Caliph"
              : null,
          sender_label:
            messageType === "timestamp"
              ? null
              : messageSide === "incoming"
              ? primarySong.artist_name || null
              : null,
          body: body || null,
          position: Number(msg.position),
          is_published: true,
          message_side: messageSide,
          display_time: null,
          audio_label: messageType === "audio" ? audioLabel || null : null,
          audio_kind: messageType === "audio" ? audioKind || null : null
        })
        .select("id")
        .single();

      if (messageError || !savedMessage) {
        return NextResponse.json(
          { ok: false, error: messageError?.message || "Could not save message." },
          { status: 500 }
        );
      }

      if (messageType === "audio") {
        const resolvedAssetSlug = assetSlug || primarySong.slug;
        const audioAssetId = assetSlugToId.get(resolvedAssetSlug);

        if (!audioAssetId) {
          return NextResponse.json(
            {
              ok: false,
              error: `Audio source "${resolvedAssetSlug}" not found for one of the messages.`
            },
            { status: 400 }
          );
        }

        const { error: clipError } = await supabaseAdmin
          .from("message_audio_clips")
          .insert({
            message_id: savedMessage.id,
            audio_asset_id: audioAssetId,
            clip_title: audioLabel || audioKind || "Audio",
            start_seconds: 0,
            end_seconds: null,
            display_duration: null
          });

        if (clipError) {
          return NextResponse.json({ ok: false, error: clipError.message }, { status: 500 });
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
