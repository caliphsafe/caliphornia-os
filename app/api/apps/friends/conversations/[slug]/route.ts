import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { verifySession } from "@/lib/session";
import { getSongPlaybackAccess } from "@/lib/access";

export async function GET(
  req: Request,
  { params }: { params: { slug: string } }
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

    const { slug } = params;

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

    const { data: finalAsset } = await supabaseAdmin
      .from("audio_assets")
      .select(`
        id,
        slug,
        title,
        storage_path,
        linked_song_id
      `)
      .eq("conversation_id", conversation.id)
      .eq("is_final_version", true)
      .eq("is_playlistable", true)
      .maybeSingle();

    let finalTrack = null;
    let canOpenConversation = false;

    if (finalAsset?.storage_path) {
      let linkedSong = null;

      if (finalAsset.linked_song_id) {
        const { data: song } = await supabaseAdmin
          .from("songs")
          .select(`
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
          .eq("id", finalAsset.linked_song_id)
          .maybeSingle();

        linkedSong = song;
      }

      const songForAccess = {
        slug: linkedSong?.slug || finalAsset.slug,
        audio_path: linkedSong?.audio_path || finalAsset.storage_path,
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

      canOpenConversation =
        playbackAccess.canPlayFull || songForAccess.is_free_full_play;

      let signedUrl: string | null = null;

      if (playbackAccess.playbackPath) {
        const { data: signed } = await supabaseAdmin.storage
          .from("songs")
          .createSignedUrl(playbackAccess.playbackPath, 60 * 60);

        signedUrl = signed?.signedUrl || null;
      }

      finalTrack = {
        slug: linkedSong?.slug || finalAsset.slug,
        title: linkedSong?.title || finalAsset.title,
        artist: linkedSong?.artist_name || null,
        file: signedUrl,
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

    const { data: messages } = await supabaseAdmin
      .from("conversation_messages")
      .select("*")
      .eq("conversation_id", conversation.id)
      .order("created_at", { ascending: true });

    return NextResponse.json({
      ok: true,
      conversation: {
        ...conversation,
        final_track: finalTrack,
      },
      messages: messages || [],
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Server error." },
      { status: 500 }
    );
  }
}