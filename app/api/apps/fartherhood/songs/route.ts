import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

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

    const { data: songs, error: songsError } = await supabaseAdmin
      .from("songs")
      .select(`
        id,
        slug,
        title,
        display_date,
        duration_label,
        description,
        audio_path,
        track_number,
        lyrics (
          body
        )
      `)
      .eq("app_id", appRow.id)
      .order("track_number", { ascending: true });

    if (songsError) {
      return NextResponse.json(
        { ok: false, error: songsError.message },
        { status: 500 }
      );
    }

    const normalized = await Promise.all(
      (songs || []).map(async (song) => {
        const { data: signed, error: signedError } = await supabaseAdmin.storage
          .from("songs")
          .createSignedUrl(song.audio_path, 60 * 60);

        return {
          title: song.title,
          date: song.display_date || "",
          duration: song.duration_label || "02:00",
          file: !signedError && signed?.signedUrl ? signed.signedUrl : "",
          transcript:
            Array.isArray(song.lyrics) && song.lyrics.length > 0
              ? song.lyrics[0].body
              : "",
          description: song.description || ""
        };
      })
    );

    return NextResponse.json({
      ok: true,
      tracks: normalized.filter((t) => t.file)
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Server error." },
      { status: 500 }
    );
  }
}
