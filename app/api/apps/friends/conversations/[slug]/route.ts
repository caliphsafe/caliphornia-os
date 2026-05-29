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

function getMessageClipId(message: AnyRow) {
  return (
    message.audio_clip_id ||
    message.clip_id ||
    message.audioClipId ||
    null
  );
}

function getClipAssetId(clip: AnyRow) {
  return (
    clip.audio_asset_id ||
    clip.asset_id ||
    clip.audioAssetId ||
    null
  );
}

function getClipStartSeconds(clip: AnyRow) {
  const value = clip.start_seconds ?? clip.start ?? clip.clip_start_seconds ?? 0;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function getClipEndSeconds(clip: AnyRow) {
  const value = clip.end_seconds ?? clip.end ?? clip.clip_end_seconds ?? null;
  if (value == null) return null;

  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function makeSongForAccess({
  asset,
  linkedSong,
}: {
  asset: AnyRow | null;
  linkedSong: AnyRow | null;
}) {
  return {
    slug: linkedSong?.slug || asset?.slug || null,
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

async function getSongsForAssets(assets: AnyRow[]) {
  const songMapById = new Map<string, AnyRow>();
  const songMapBySlug = new Map<string, AnyRow>();

  const linkedSongIds = Array.from(
    new Set(
      assets
        .map((asset) => asset?.linked_song_id)
        .filter(Boolean)
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
      assets
        .map((asset) => asset?.slug)
        .filter(Boolean)
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
  songMapById,
  songMapBySlug,
}: {
  asset: AnyRow | null;
  songMapById: Map<string, AnyRow>;
  songMapBySlug: Map<string, AnyRow>;
}) {
  if (!asset) return null;

  if (asset.linked_song_id && songMapById.has(asset.linked_song_id)) {
    return songMapById.get(asset.linked_song_id) || null;
  }

  if (asset.slug && songMapBySlug.has(asset.slug)) {
    return songMapBySlug.get(asset.slug) || null;
  }

  return null;
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

    const { data: appRow } = await supabaseAdmin
      .from("apps")
      .select("id")
      .eq("slug", "friends")
      .single();

    if (!appRow) {
      return NextResponse.json(
        { ok: false, error: "Friends app not found." },
        { status: 404 }
      );
    }

    const { data: conversation } = await supabaseAdmin
      .from("conversations")
      .select("*")
      .eq("slug", slug)
      .eq("app_id", appRow.id)
      .maybeSingle();

    if (!conversation) {
      return NextResponse.json(
        { ok: false, error: "Conversation not found." },
        { status: 404 }
      );
    }

    const { data: messages } = await supabaseAdmin
      .from("conversation_messages")
      .select("*")
      .eq("conversation_id", conversation.id)
      .order("created_at", { ascending: true });

    const { data: clips } = await supabaseAdmin
      .from("audio_clips")
      .select("*")
      .eq("conversation_id", conversation.id);

    const clipsList = clips || [];
    const clipMap = new Map<string, AnyRow>();

    for (const clip of clipsList) {
      clipMap.set(clip.id, clip);
    }

    const assetIds = Array.from(
      new Set(
        clipsList
          .map((clip) => getClipAssetId(clip))
          .filter(Boolean)
      )
    );

    const { data: finalAsset } = await supabaseAdmin
      .from("audio_assets")
      .select(`
        id,
        slug,
        title,
        storage_path,
        version_label,
        is_final_version,
        is_playlistable,
        linked_song_id
      `)
      .eq("conversation_id", conversation.id)
      .eq("is_final_version", true)
      .eq("is_playlistable", true)
      .maybeSingle();

    if (finalAsset?.id && !assetIds.includes(finalAsset.id)) {
      assetIds.push(finalAsset.id);
    }

    const assetMap = new Map<string, AnyRow>();
    const assetsForSongLookup: AnyRow[] = [];

    if (assetIds.length) {
      const { data: assets } = await supabaseAdmin
        .from("audio_assets")
        .select(`
          id,
          slug,
          title,
          storage_path,
          version_label,
          is_final_version,
          is_playlistable,
          linked_song_id
        `)
        .in("id", assetIds);

      for (const asset of assets || []) {
        assetMap.set(asset.id, asset);
        assetsForSongLookup.push(asset);
      }
    }

    if (finalAsset && !assetMap.has(finalAsset.id)) {
      assetMap.set(finalAsset.id, finalAsset);
      assetsForSongLookup.push(finalAsset);
    }

    const { songMapById, songMapBySlug } = await getSongsForAssets(assetsForSongLookup);

    const resolvedFinalAsset = finalAsset
      ? assetMap.get(finalAsset.id) || finalAsset
      : null;

    const linkedFinalSong = getLinkedSongForAsset({
      asset: resolvedFinalAsset,
      songMapById,
      songMapBySlug,
    });

    let finalTrack = null;
    let canOpenConversation = false;

    if (resolvedFinalAsset?.storage_path) {
      const songForAccess = makeSongForAccess({
        asset: resolvedFinalAsset,
        linkedSong: linkedFinalSong,
      });

      const playbackAccess = await getSongPlaybackAccess({
        userEmail: session.email,
        projectSlug: "friends",
        song: songForAccess,
      });

      canOpenConversation =
        playbackAccess.canPlayFull || Boolean(songForAccess.is_free_full_play);

      const signedUrl = playbackAccess.playbackPath
        ? await createSignedSongUrl(playbackAccess.playbackPath)
        : null;

      finalTrack = {
        slug: linkedFinalSong?.slug || resolvedFinalAsset.slug,
        title: linkedFinalSong?.title || resolvedFinalAsset.title,
        artist: linkedFinalSong?.artist_name || null,
        file: signedUrl,
        playlist_song_slug: linkedFinalSong?.slug || resolvedFinalAsset.slug,
        analytics_song_slug: linkedFinalSong?.slug || resolvedFinalAsset.slug,
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

    const hydratedMessages = await Promise.all(
      (messages || []).map(async (message) => {
        if (message.message_type !== "audio") {
          return message;
        }

        const clipId = getMessageClipId(message);
        const clip = clipId ? clipMap.get(clipId) : null;

        if (!clip) {
          return {
            ...message,
            clip: null,
          };
        }

        const assetId = getClipAssetId(clip);
        const asset = assetId ? assetMap.get(assetId) || null : null;
        const linkedSong = getLinkedSongForAsset({
          asset,
          songMapById,
          songMapBySlug,
        });

        const storagePath =
          asset?.storage_path ||
          clip.storage_path ||
          null;

        const signedClipUrl = await createSignedSongUrl(storagePath);

        return {
          ...message,
          clip: {
            id: clip.id,
            clip_title:
              clip.clip_title ||
              clip.title ||
              asset?.title ||
              message.audio_label ||
              "Audio",
            start_seconds: getClipStartSeconds(clip),
            end_seconds: getClipEndSeconds(clip),
            display_duration: clip.display_duration || null,
            file: signedClipUrl,
            signing_error: signedClipUrl ? null : "Could not sign audio file.",
            playlist_song_slug:
              linkedSong?.slug ||
              asset?.slug ||
              null,
            playlist_song_title:
              linkedSong?.title ||
              asset?.title ||
              null,
            playlist_song_artist:
              linkedSong?.artist_name ||
              conversation.subtitle ||
              null,
            asset: asset
              ? {
                  id: asset.id,
                  slug: asset.slug,
                  title: asset.title,
                  storage_path: asset.storage_path,
                  version_label: asset.version_label || null,
                  is_final_version: Boolean(asset.is_final_version),
                  is_playlistable: Boolean(asset.is_playlistable),
                  linked_song_id: asset.linked_song_id || null,
                }
              : null,
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
