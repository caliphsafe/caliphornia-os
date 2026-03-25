import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET() {
  try {
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

    const conversationIds = (conversations || []).map((c) => c.id);

    if (!conversationIds.length) {
      return NextResponse.json({
        ok: true,
        conversations: []
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

    const songMap = new Map<string, { slug: string; title: string; artist_name: string | null }>();

    if (linkedSongIds.length) {
      const { data: songs } = await supabaseAdmin
        .from("songs")
        .select("id, slug, title, artist_name")
        .in("id", linkedSongIds);

      for (const song of songs || []) {
        songMap.set(song.id, song);
      }
    }

    const finalTrackMap = new Map<string, any>();

    for (const asset of finalAssets || []) {
      if (!asset?.conversation_id || !asset?.storage_path) continue;

      let signedUrl: string | null = null;

      const { data: signed, error: signedError } = await supabaseAdmin.storage
        .from("songs")
        .createSignedUrl(asset.storage_path, 60 * 60);

      if (!signedError) {
        signedUrl = signed?.signedUrl || null;
      }

      const linkedSong = asset.linked_song_id
        ? songMap.get(asset.linked_song_id)
        : null;

      finalTrackMap.set(asset.conversation_id, {
        slug: linkedSong?.slug || asset.slug,
        title: linkedSong?.title || asset.title,
        artist: linkedSong?.artist_name || null,
        file: signedUrl,
        playlist_song_slug: linkedSong?.slug || asset.slug,
        analytics_song_slug: linkedSong?.slug || asset.slug
      });
    }

    const normalizedConversations = (conversations || []).map((conversation) => ({
      ...conversation,
      final_track: finalTrackMap.has(conversation.id)
        ? finalTrackMap.get(conversation.id)
        : null
    }));

    return NextResponse.json({
      ok: true,
      conversations: normalizedConversations
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Server error." },
      { status: 500 }
    );
  }
}