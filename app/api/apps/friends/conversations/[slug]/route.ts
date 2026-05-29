import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { verifySession } from "@/lib/session";
import { getSongPlaybackAccess } from "@/lib/access";

const ROUTE_VERSION = "friends-v5-access-global-player";

type SongRow = {
  id?: string;
  slug: string;
  title: string;
  artist_name: string | null;
  audio_path?: string | null;
  preview_audio_path?: string | null;
  preview_starts_at?: number | null;
  preview_duration?: number | null;
  release_at?: string | null;
  early_access_at?: string | null;
  is_locked?: boolean | null;
  requires_project_access?: boolean | null;
  requires_all_access?: boolean | null;
  is_free_full_play?: boolean | null;
};

function firstItem(value: any) {
  if (Array.isArray(value)) return value[0] || null;
  return value || null;
}

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
  asset: any | null;
  linkedSong: SongRow | null;
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

async function getSongById(songId: string | null | undefined) {
  if (!songId) return null;

  const { data } = await supabaseAdmin
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
      is_free_full_play
    `)
    .eq("id", songId)
    .maybeSingle();

  return (data || null) as SongRow | null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("caliph_os_session")?.value ?? null;
    const session = verifySession(token);

    if (!session?.email) {
      return NextResponse.json(
        {
          ok: false,
          routeVersion: ROUTE_VERSION,
          error: "Unauthorized.",
        },
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
        {
          ok: false,
          routeVersion: ROUTE_VERSION,
          error: appError?.message || "Friends app not found.",
        },
        { status: 404 }
      );
    }

    const { data: conversation, error: conversationError } = await supabaseAdmin
      .from("conversations")
      .select(`
        id,
        app_id,
        slug,
        title,
        subtitle,
        avatar_letter,
        list_preview,
        last_activity_label,
        sort_order,
        is_published,
        primary_song_id,
        cover_image_path,
        cover_image_bucket
      `)
      .eq("slug", slug)
      .eq("app_id", appRow.id)
      .eq("is_published", true)
      .maybeSingle();

    if (conversationError || !conversation) {
      return NextResponse.json(
        {
          ok: false,
          routeVersion: ROUTE_VERSION,
          error: conversationError?.message || "Conversation not found.",
        },
        { status: 404 }
      );
    }

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
        linked_song_id,
        song_id,
        song_slug
      `)
      .eq("conversation_id", conversation.id)
      .eq("is_final_version", true)
      .eq("is_playlistable", true)
      .maybeSingle();

    const linkedFinalSong =
      (await getSongById(finalAsset?.linked_song_id)) ||
      (await getSongById(finalAsset?.song_id)) ||
      (await getSongById(conversation.primary_song_id));

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

      const signedFinalUrl = playbackAccess.playbackPath
        ? await createSignedSongUrl(playbackAccess.playbackPath)
        : null;

      finalTrack = {
        slug:
          linkedFinalSong?.slug ||
          finalAsset.song_slug ||
          finalAsset.slug,
        title:
          linkedFinalSong?.title ||
          finalAsset.title,
        artist:
          linkedFinalSong?.artist_name ||
          conversation.subtitle ||
          null,
        file: signedFinalUrl,
        playlist_song_slug:
          linkedFinalSong?.slug ||
          finalAsset.song_slug ||
          finalAsset.slug,
        analytics_song_slug:
          linkedFinalSong?.slug ||
          finalAsset.song_slug ||
          finalAsset.slug,
        is_preview: playbackAccess.isPreview,
        can_play_full: playbackAccess.canPlayFull,
        can_open_conversation: canOpenConversation,
        locked_reason: playbackAccess.lockedReason,
        clip_start_seconds: playbackAccess.clipStartSeconds,
        clip_end_seconds: playbackAccess.clipEndSeconds,
      };
    }

    if (!canOpenConversation) {
      return NextResponse.json({
        ok: true,
        routeVersion: ROUTE_VERSION,
        locked: true,
        final_track: finalTrack,
      });
    }

    const { data: messages, error: messagesError } = await supabaseAdmin
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
        is_published,
        message_audio_clips (
          id,
          clip_title,
          start_seconds,
          end_seconds,
          display_duration,
          audio_assets (
            id,
            slug,
            title,
            storage_path,
            version_label,
            is_final_version,
            is_playlistable,
            linked_song_id
          )
        )
      `)
      .eq("conversation_id", conversation.id)
      .eq("is_published", true)
      .order("position", { ascending: true });

    if (messagesError) {
      return NextResponse.json(
        {
          ok: false,
          routeVersion: ROUTE_VERSION,
          error: messagesError.message,
        },
        { status: 500 }
      );
    }

    const clipLinkedSongIds = Array.from(
      new Set(
        (messages || [])
          .flatMap((msg: any) => {
            const clips = Array.isArray(msg.message_audio_clips)
              ? msg.message_audio_clips
              : msg.message_audio_clips
                ? [msg.message_audio_clips]
                : [];

            return clips
              .map((clip: any) => {
                const asset = firstItem(clip.audio_assets);
                return asset?.linked_song_id || null;
              })
              .filter(Boolean);
          })
      )
    );

    const allSongIds = Array.from(
      new Set([
        ...clipLinkedSongIds,
        ...(linkedFinalSong?.id ? [linkedFinalSong.id] : []),
      ])
    );

    const songMap = new Map<
      string,
      {
        id: string;
        slug: string;
        title: string;
        artist_name: string | null;
      }
    >();

    if (allSongIds.length) {
      const { data: songs } = await supabaseAdmin
        .from("songs")
        .select("id, slug, title, artist_name")
        .in("id", allSongIds);

      for (const song of songs || []) {
        songMap.set(song.id, song);
      }
    }

    const normalizedMessages = await Promise.all(
      (messages || []).map(async (msg: any) => {
        const clip = firstItem(msg.message_audio_clips);
        const asset = clip?.audio_assets ? firstItem(clip.audio_assets) : null;

        let signedUrl: string | null = null;
        let signingError: string | null = null;

        if (asset?.storage_path) {
          const { data: signed, error: signedError } = await supabaseAdmin.storage
            .from("songs")
            .createSignedUrl(asset.storage_path, 60 * 60);

          if (signedError) {
            signingError = signedError.message;
          } else {
            signedUrl = signed?.signedUrl || null;
          }
        } else if (asset) {
          signingError = "Missing storage_path on audio asset.";
        }

        const clipSong = asset?.linked_song_id
          ? songMap.get(asset.linked_song_id)
          : null;

        const fallbackSong = linkedFinalSong?.id
          ? songMap.get(linkedFinalSong.id) || linkedFinalSong
          : linkedFinalSong;

        return {
          id: msg.id,
          message_type: msg.message_type,
          sender_name: msg.sender_name,
          sender_label: msg.sender_label,
          body: msg.body,
          position: msg.position,
          message_side: msg.message_side,
          display_time: msg.display_time,
          audio_label: msg.audio_label,
          audio_kind: msg.audio_kind,
          clip: clip
            ? {
                id: clip.id,
                clip_title: clip.clip_title,
                start_seconds: Number(clip.start_seconds || 0),
                end_seconds:
                  clip.end_seconds !== null && clip.end_seconds !== undefined
                    ? Number(clip.end_seconds)
                    : null,
                display_duration: clip.display_duration,
                file: signedUrl,
                signing_error: signingError,
                playlist_song_slug:
                  clipSong?.slug ||
                  fallbackSong?.slug ||
                  null,
                playlist_song_title:
                  clipSong?.title ||
                  fallbackSong?.title ||
                  null,
                playlist_song_artist:
                  clipSong?.artist_name ||
                  fallbackSong?.artist_name ||
                  null,
                asset: asset
                  ? {
                      id: asset.id,
                      slug: asset.slug,
                      title: asset.title,
                      storage_path: asset.storage_path,
                      version_label: asset.version_label,
                      is_final_version: asset.is_final_version,
                      is_playlistable: asset.is_playlistable,
                      linked_song_id: asset.linked_song_id,
                    }
                  : null,
              }
            : null,
        };
      })
    );

    return NextResponse.json({
      ok: true,
      routeVersion: ROUTE_VERSION,
      locked: false,
      conversation: {
        ...conversation,
        final_track: finalTrack,
      },
      messages: normalizedMessages,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        routeVersion: ROUTE_VERSION,
        error: error?.message || "Server error.",
      },
      { status: 500 }
    );
  }
}
