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
        song_title,
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
        artist,
        cover_image,
        file_url
      `)
      .in("id", songIds);

    if (songsError) {
      return NextResponse.json(
        { ok: false, error: songsError.message },
        { status: 500 }
      );
    }

    const songMap = new Map(
      (songs || []).map((song) => [song.id, song])
    );

    const orderedSongs = (favorites || [])
      .map((favorite) => {
        const song = songMap.get(favorite.song_id);
        if (!song) return null;

        return {
          favorite_id: favorite.id,
          favorited_at: favorite.created_at,
          song_id: song.id,
          slug: song.slug,
          title: song.title || favorite.song_title || favorite.song_slug || "Untitled",
          artist: song.artist || "Caliph",
          cover_image: song.cover_image || null,
          file: song.file_url || null
        };
      })
      .filter(Boolean);

    return NextResponse.json({
      ok: true,
      songs: orderedSongs
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Server error" },
      { status: 500 }
    );
  }
}
