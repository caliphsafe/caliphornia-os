import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { verifySession } from "@/lib/session";
import { getSongPlaybackAccess } from "@/lib/access";

type AnyRow = Record<string, any>;

async function createSignedSongUrl(storagePath: string | null | undefined) {
  if (!storagePath) return null;

  const { data, error } = await supabaseAdmin.storage
    .from("songs")
    .createSignedUrl(storagePath, 60 * 60);

  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

function makeSongForAccess({
  asset,
  linkedSong,
}: {
  asset: AnyRow | null;
  linkedSong: AnyRow | null;
}) {
  return {
    slug: linkedSong?.slug || asset?.song_slug || asset?.slug || null,
    audio_path: linkedSong?.audio_path || asset?.storage_path || null,
    preview_audio_path: linkedSong?.preview_audio_path || null,
    preview_starts_at: linkedSong?.preview_starts_at ?? 0,
    preview_duration: linkedSong?.preview_duration ?? 30,
    release_at: linkedSong?.release_at || null,
    early_access_at: linkedSong?.early_access_at || null,
    is_locked: linkedSong?.is_locked ?? true,
    requires_project_access: linkedSong?.requires_project_access ?? true,
    requires_all_access: linkedSong?.requires_all_access ?? false,
    is_free_full_play: linkedSong?.is_free_full_play ?? false,
  };
}

async function getSongsForAssets({
  assets,
  primarySongId,
}: {
  assets: AnyRow[];
  primarySongId?: string | null;
}) {
  const songMapById = new Map<string, AnyRow>();
  const songMapBySlug = new Map<string, AnyRow>();

  const linkedSongIds = Array.from(
    new Set(
      [
        primarySongId,
        ...assets.map((asset) => asset?.linked_song_id),
        ...assets.map((asset) => asset?.song_id),
      ].filter(Boolean)
    )
  );

  if (linkedSongIds.length) {
    const { data: songs } = await supabaseAdmin
      .from("songs")
      .select(`
        id,
        slug,
        title,
        artist_name,
        audio_path,
        preview_audio_path,
        preview_starts_at,
        preview_duration,
        release_at,
        early_access_at,
        is_locked,
        requires_project_access,
        requires_all_access,
        is_free_full_play,
        duration_label,
        description
      `)
      .in("id", linkedSongIds);

    for (const song of songs || []) {
      songMapById.set(song.id, song);
      songMapBySlug.set(song.slug, song);
    }
  }

  const assetSlugs = Array.from(
    new Set(
      [
        ...assets.map((asset) => asset?.song_slug),
        ...assets.map((asset) => asset?.slug),
      ].filter(Boolean)
    )
  );

  const missingSlugs = assetSlugs.filter((slug) => !songMapBySlug.has(slug));

  if (missingSlugs.length) {
    const { data: songsBySlug } = await supabaseAdmin
      .from("songs")
      .select(`
        id,
        slug,
        title,
        artist_name,
        audio_path,
        preview_audio_path,
        preview_starts_at,
        preview_duration,
        release_at,
        early_access_at,
        is_locked,
        requires_project_access,
        requires_all_access,
        is_free_full_play,
        duration_label,
        description
      `)
      .in("slug", missingSlugs);

    for (const song of songsBySlug || []) {
      songMapById.set(song.id, song);
      songMapBySlug.set(song.slug, song);
    }
  }

  return { songMapById, songMapBySlug };
}

function getLinkedSongForAsset({
  asset,
  primarySongId,
  songMapById,
  songMapBySlug,
}: {
  asset: AnyRow | null;
  primarySongId?: string | null;
  songMapById: Map<string, AnyRow>;
  songMapBySlug: Map<string, AnyRow>;
}) {
  if (asset?.linked_song_id && songMapById.has(asset.linked_song_id)) {
    return songMapById.get(asset.linked_song_id) || null;
  }

  if (asset?.song_id && songMapById.has(asset.song_id)) {
    return songMapById.get(asset.song_id) || null;
  }

  if (asset?.song_slug && songMapBySlug.has(asset.song_slug)) {
    return songMapBySlug.get(asset.song_slug) || null;
  }

  if (asset?.slug && songMapBySlug.has(asset.slug)) {
    return songMapBySlug.get(asset.slug) || null;
  }

  if (primarySongId && songMapById.has(primarySongId)) {
    return songMapById.get(primarySongId) || null;
  }

  return null;
}

function pickAssetForAudioMessage({
  message,
  audioIndex,
  audioMessageCount,
  assets,
  nonFinalAssets,
  finalAsset,
}: {
  message: AnyRow;
  audioIndex: number;
  audioMessageCount: number;
  assets: AnyRow[];
  nonFinalAssets: AnyRow[];
  finalAsset: AnyRow | null;
}) {
  const label = String(
    message.audio_label || message.audio_kind || message.body || ""
  ).toLowerCase();

  if (label.includes("final")) {
    return finalAsset || assets[assets.length - 1] || null;
  }

  const exactTitleMatch = assets.find((asset) => {
    const title = String(asset.title || "").toLowerCase();
    const slug = String(asset.slug || "").toLowerCase();
    return title && label && (label.includes(title) || title.includes(label) || label.includes(slug));
  });

  if (exactTitleMatch) {
    return exactTitleMatch;
  }

  if (label.includes("open")) {
    return (
      nonFinalAssets.find((asset) =>
        String(asset.title || asset.slug || "").toLowerCase().includes("open")
      ) ||
      nonFinalAssets[audioIndex] ||
      finalAsset ||
      null
    );
  }

  if (label.includes("verse") && audioIndex < nonFinalAssets.length) {
    return nonFinalAssets[audioIndex] || null;
  }

  if (audioIndex === audioMessageCount - 1) {
    return finalAsset || assets[assets.length - 1] || null;
  }

  return nonFinalAssets[audioIndex] || finalAsset || assets[audioIndex] || assets[0] || null;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("caliph_os_session")?.value ?? null;
    const session = verifySession(token);

    if (!session?.email) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized." },
        { status: 401 }
      );
    }

    const { slug } = await params;

    const { data: appRow, error: appError } = await supabaseAdmin
      .from("apps")
      .select("id")
      .eq("slug", "friends")
      .single();

    if (appError || !appRow) {
      return NextResponse.json(
        { ok: false, error: appError?.message || "Friends app not found." },
        { status: 404 }
      );
    }

    const { data: conversation, error: conversationError } = await supabaseAdmin
      .from("conversations")
      .select("*")
      .eq("slug", slug)
      .eq("app_id", appRow.id)
      .maybeSingle();

    if (conversationError || !conversation) {
      return NextResponse.json(
        { ok: false, error: conversationError?.message || "Conversation not found." },
        { status: 404 }
      );
    }

    const { data: assets, error: assetsError } = await supabaseAdmin
      .from("audio_assets")
      .select(`
        id,
        conversation_id,
        slug,
        title,
        storage_path,
        version_label,
        is_final_version,
        is_playlistable,
        linked_song_id,
        song_id,
        song_slug,
        created_at
      `)
      .eq("conversation_id", conversation.id)
      .order("created_at", { ascending: true });

    if (assetsError) {
      return NextResponse.json(
        { ok: false, error: assetsError.message },
        { status: 500 }
      );
    }

    const assetsList = assets || [];

    const finalAsset =
      assetsList.find(
        (asset) => Boolean(asset.is_final_version) && Boolean(asset.is_playlistable)
      ) ||
      assetsList.find((asset) => Boolean(asset.is_final_version)) ||
      assetsList[assetsList.length - 1] ||
      null;

    const nonFinalAssets = assetsList.filter(
      (asset) => !Boolean(asset.is_final_version)
    );

    const { songMapById, songMapBySlug } = await getSongsForAssets({
      assets: assetsList,
      primarySongId: conversation.primary_song_id || null,
    });

    const linkedFinalSong = getLinkedSongForAsset({
      asset: finalAsset,
      primarySongId: conversation.primary_song_id || null,
      songMapById,
      songMapBySlug,
    });

    let finalTrack = null;
    let canOpenConversation = false;

    if (finalAsset?.storage_path) {
      const songForAccess = makeSongForAccess({
        asset: finalAsset,
        linkedSong: linkedFinalSong,
      });

      const playbackAccess = await getSongPlaybackAccess({
        userEmail: session.email,
        projectSlug: "friends",
        song: songForAccess,
      });

      canOpenConversation =
        playbackAccess.canPlayFull || Boolean(songForAccess.is_free_full_play);

      const finalPlaybackPath =
        playbackAccess.playbackPath || finalAsset.storage_path || null;

      const signedUrl = finalPlaybackPath
        ? await createSignedSongUrl(finalPlaybackPath)
        : null;

      finalTrack = {
        slug: linkedFinalSong?.slug || finalAsset.song_slug || finalAsset.slug,
        title: linkedFinalSong?.title || finalAsset.title,
        artist: linkedFinalSong?.artist_name || conversation.subtitle || null,
        file: signedUrl,
        playlist_song_slug: linkedFinalSong?.slug || finalAsset.song_slug || finalAsset.slug,
        analytics_song_slug: linkedFinalSong?.slug || finalAsset.song_slug || finalAsset.slug,
        is_preview: playbackAccess.isPreview,
        can_play_full: playbackAccess.canPlayFull,
        clip_start_seconds: playbackAccess.clipStartSeconds,
        clip_end_seconds: playbackAccess.clipEndSeconds,
      };
    }

    if (!canOpenConversation) {
      return NextResponse.json({
        ok: true,
        locked: true,
        final_track: finalTrack,
      });
    }

    const { data: messages, error: messagesError } = await supabaseAdmin
      .from("conversation_messages")
      .select("*")
      .eq("conversation_id", conversation.id)
      .eq("is_published", true)
      .order("position", { ascending: true });

    if (messagesError) {
      return NextResponse.json(
        { ok: false, error: messagesError.message },
        { status: 500 }
      );
    }

    const audioMessages = (messages || []).filter(
      (message) => message.message_type === "audio"
    );

    let audioIndex = 0;

    const hydratedMessages = await Promise.all(
      (messages || []).map(async (message) => {
        if (message.message_type !== "audio") {
          return message;
        }

        const currentAudioIndex = audioIndex;
        audioIndex += 1;

        const asset = pickAssetForAudioMessage({
          message,
          audioIndex: currentAudioIndex,
          audioMessageCount: audioMessages.length,
          assets: assetsList,
          nonFinalAssets,
          finalAsset,
        });

        if (!asset?.storage_path) {
          return {
            ...message,
            clip: null,
          };
        }

        const linkedSong = getLinkedSongForAsset({
          asset,
          primarySongId: conversation.primary_song_id || null,
          songMapById,
          songMapBySlug,
        });

        const signedClipUrl = await createSignedSongUrl(asset.storage_path);

        return {
          ...message,
          clip: {
            id: message.id,
            clip_title:
              message.audio_label ||
              asset.version_label ||
              asset.title ||
              "Audio",
            start_seconds: 0,
            end_seconds: null,
            display_duration: null,
            file: signedClipUrl,
            signing_error: signedClipUrl ? null : "Could not sign audio file.",
            playlist_song_slug:
              linkedSong?.slug ||
              asset.song_slug ||
              asset.slug ||
              null,
            playlist_song_title:
              linkedSong?.title ||
              asset.title ||
              message.audio_label ||
              null,
            playlist_song_artist:
              linkedSong?.artist_name ||
              conversation.subtitle ||
              null,
            asset: {
              id: asset.id,
              slug: asset.slug,
              title: asset.title,
              storage_path: asset.storage_path,
              version_label: asset.version_label || null,
              is_final_version: Boolean(asset.is_final_version),
              is_playlistable: Boolean(asset.is_playlistable),
              linked_song_id: asset.linked_song_id || null,
            },
          },
        };
      })
    );

    return NextResponse.json({
      ok: true,
      conversation: {
        ...conversation,
        final_track: finalTrack,
      },
      messages: hydratedMessages,
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Server error." },
      { status: 500 }
    );
  }
}
