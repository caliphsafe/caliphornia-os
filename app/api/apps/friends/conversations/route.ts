import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { verifySession } from "@/lib/session";
import { getSongPlaybackAccess } from "@/lib/access";

export async function GET() {
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

    const { data: conversations, error: conversationsError } = await supabaseAdmin
      .from("conversations")
      .select(`
        id,
        slug,
        title,
        subtitle,
        avatar_letter,
        list_preview,
        last_activity_label,
        sort_order,
        is_published
      `)
      .eq("app_id", appRow.id)
      .eq("is_published", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });

    if (conversationsError) {
      return NextResponse.json(
        { ok: false, error: conversationsError.message },
        { status: 500 }
      );
    }

    const conversationIds = (conversations || []).map((conversation) => conversation.id);

    if (!conversationIds.length) {
      return NextResponse.json({
        ok: true,
        conversations: [],
      });
    }

    const { data: finalAssets, error: finalAssetsError } = await supabaseAdmin
      .from("audio_assets")
      .select(`
        id,
        conversation_id,
        slug,
        title,
        storage_path,
        is_final_version,
        is_playlistable,
        linked_song_id
      `)
      .in("conversation_id", conversationIds)
      .eq("is_final_version", true)
      .eq("is_playlistable", true);

    if (finalAssetsError) {
      return NextResponse.json(
        { ok: false, error: finalAssetsError.message },
        { status: 500 }
      );
    }

    const linkedSongIds = Array.from(
      new Set(
        (finalAssets || [])
          .map((asset) => asset.linked_song_id)
          .filter(Boolean)
      )
    );

    const songMap = new Map<string, any>();

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
        songMap.set(song.id, song);
      }
    }

    const finalTrackMap = new Map<string, any>();

    for (const asset of finalAssets || []) {
      if (!asset?.conversation_id || !asset?.storage_path) continue;

      const linkedSong = asset.linked_song_id
        ? songMap.get(asset.linked_song_id)
        : null;

      const songForAccess = {
        slug: linkedSong?.slug || asset.slug,
        audio_path: linkedSong?.audio_path || asset.storage_path,
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

      const playbackAccess = await getSongPlaybackAccess({
        userEmail: session.email,
        projectSlug: "friends",
        song: songForAccess,
      });

      let signedUrl: string | null = null;

      if (playbackAccess.playbackPath) {
        const { data: signed, error: signedError } = await supabaseAdmin.storage
          .from("songs")
          .createSignedUrl(playbackAccess.playbackPath, 60 * 60);

        if (!signedError) {
          signedUrl = signed?.signedUrl || null;
        }
      }

      finalTrackMap.set(asset.conversation_id, {
        slug: linkedSong?.slug || asset.slug,
        title: linkedSong?.title || asset.title,
        artist: linkedSong?.artist_name || null,
        file: signedUrl,
        playlist_song_slug: linkedSong?.slug || asset.slug,
        analytics_song_slug: linkedSong?.slug || asset.slug,
        is_preview: playbackAccess.isPreview,
        can_play_full: playbackAccess.canPlayFull,
        can_open_conversation: playbackAccess.canPlayFull,
        locked_reason: playbackAccess.lockedReason,
        clip_start_seconds: playbackAccess.clipStartSeconds,
        clip_end_seconds: playbackAccess.clipEndSeconds,
      });
    }

    const normalizedConversations = (conversations || []).map((conversation) => {
      const finalTrack = finalTrackMap.has(conversation.id)
        ? finalTrackMap.get(conversation.id)
        : null;

      return {
        ...conversation,
        can_open_conversation: Boolean(finalTrack?.can_open_conversation),
        is_preview: Boolean(finalTrack?.is_preview),
        locked_reason: finalTrack?.locked_reason || null,
        final_track: finalTrack,
      };
    });

    return NextResponse.json({
      ok: true,
      conversations: normalizedConversations,
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Server error." },
      { status: 500 }
    );
  }
}
