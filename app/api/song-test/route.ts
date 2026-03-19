import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET() {
  try {
    const { data: song, error: songError } = await supabaseAdmin
      .from("songs")
      .select("id, title, audio_path")
      .eq("slug", "fartherhood-story-time")
      .single();

    if (songError || !song) {
      return NextResponse.json(
        { ok: false, error: songError?.message || "Song not found." },
        { status: 404 }
      );
    }

    const { data, error } = await supabaseAdmin.storage
      .from("songs")
      .createSignedUrl(song.audio_path, 60 * 10);

    if (error || !data?.signedUrl) {
      return NextResponse.json(
        { ok: false, error: error?.message || "Could not create signed URL." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      title: song.title,
      audio_path: song.audio_path,
      signedUrl: data.signedUrl
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Server error." },
      { status: 500 }
    );
  }
}
