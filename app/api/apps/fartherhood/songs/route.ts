import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

function getLyricsBody(lyrics: any): string {
  if (!lyrics) return "";

  if (Array.isArray(lyrics)) {
    const primary = lyrics.find((row: any) => row?.is_primary === true);
    return primary?.body || lyrics[0]?.body || "";
  }

  if (typeof lyrics === "object" && lyrics.body) {
    return lyrics.body;
  }

  return "";
}

export async function GET() {
  try {
    const { data: appRow, error: appError } = await supabaseAdmin
      .from("apps")
      .select("id")
      .eq("slug", "fartherhood")
      .single();

    if (appError || !appRow) {
      return NextResponse.json(
        { ok: false, error: appError?.message || "App not found." },
        { status: 404 }
      );
    }

    const { data: appSongs, error: appSongsError } = await supabaseAdmin
      .from("app_songs")
      .select(`
        position,
        songs (
          id,
          slug,
          title,
          artist_name,
          producer_names,
          display_date,
          duration_label,
          description,
          audio_path,
          lyrics (
            body,
            is_primary
          )
        )
      `)
      .eq("app_id", appRow.id)
      .order("position", { ascending: true });

    if (appSongsError) {
      return NextResponse.json(
        { ok: false, error: appSongsError.message },
        { status: 500 }
      );
    }

    const normalized = await Promise.all(
      (appSongs || []).map(async (row: any) => {
        const song = Array.isArray(row.songs) ? row.songs[0] : row.songs;
        if (!song?.audio_path) return null;

        const { data: signed, error: signedError } = await supabaseAdmin.storage
          .from("songs")
          .createSignedUrl(song.audio_path, 60 * 60);

        if (signedError || !signed?.signedUrl) return null;

        return {
          id: song.id,
          slug: song.slug,
          title: song.title,
          artistName: song.artist_name || "",
          producerNames: song.producer_names || "",
          date: song.display_date || "",
          duration: song.duration_label || "02:00",
          file: signed.signedUrl,
          transcript: getLyricsBody(song.lyrics),
          description: song.description || ""
        };
      })
    );

    return NextResponse.json({
      ok: true,
      tracks: normalized.filter(Boolean)
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Server error." },
      { status: 500 }
    );
  }
}
