import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userEmail = String(searchParams.get("userEmail") || "").trim().toLowerCase();

    if (!userEmail) {
      return NextResponse.json(
        { ok: false, error: "Missing userEmail" },
        { status: 400 }
      );
    }

    const { data: favorites, error: favoritesError } = await supabaseAdmin
      .from("user_favorite_songs")
      .select(`
        id,
        user_email,
        song_id,
        song_slug,
        created_at
      `)
      .eq("user_email", userEmail)
      .order("created_at", { ascending: false });

    if (favoritesError) {
      return NextResponse.json(
        { ok: false, error: favoritesError.message },
        { status: 500 }
      );
    }

    const songIds = (favorites || [])
      .map((row) => row.song_id)
      .filter(Boolean);

    if (!songIds.length) {
      return NextResponse.json({
        ok: true,
        songs: []
      });
    }

    const { data: songs, error: songsError } = await supabaseAdmin
      .from("songs")
      .select(`
        id,
        slug,
        title,
        artist_name,
        audio_path,
        cover_image_path
      `)
      .in("id", songIds);

    if (songsError) {
      return NextResponse.json(
        { ok: false, error: songsError.message },
        { status: 500 }
      );
    }

    const songMap = new Map((songs || []).map((song) => [song.id, song]));

    const orderedSongs = await Promise.all(
      (favorites || []).map(async (favorite) => {
        const song = songMap.get(favorite.song_id);
        if (!song) return null;

        let audioUrl: string | null = null;
        let coverUrl: string | null = null;

        if (song.audio_path) {
          const { data: signedAudio, error: signedAudioError } =
            await supabaseAdmin.storage
              .from("songs")
              .createSignedUrl(song.audio_path, 60 * 60);

          if (!signedAudioError) {
            audioUrl = signedAudio?.signedUrl || null;
          }
        }

        if (song.cover_image_path) {
          const { data: signedCover, error: signedCoverError } =
            await supabaseAdmin.storage
              .from("songs")
              .createSignedUrl(song.cover_image_path, 60 * 60);

          if (!signedCoverError) {
            coverUrl = signedCover?.signedUrl || null;
          }
        }

        return {
          favorite_id: favorite.id,
          favorited_at: favorite.created_at,
          song_id: song.id,
          slug: song.slug,
          title: song.title || favorite.song_slug || "Untitled",
          artist: song.artist_name || "Caliph",
          cover_image: coverUrl,
          file: audioUrl
        };
      })
    );

    return NextResponse.json({
      ok: true,
      songs: orderedSongs.filter(Boolean)
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Server error" },
      { status: 500 }
    );
  }
}
