import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userEmail = String(searchParams.get("userEmail") || "").trim().toLowerCase();
    const songSlug = String(searchParams.get("songSlug") || "").trim();

    if (!userEmail || !songSlug) {
      return NextResponse.json(
        { ok: false, error: "Missing fields" },
        { status: 400 }
      );
    }

    const { data: song, error: songError } = await supabaseAdmin
      .from("songs")
      .select("id")
      .eq("slug", songSlug)
      .single();

    if (songError || !song) {
      return NextResponse.json(
        { ok: true, saved: false }
      );
    }

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("user_favorite_songs")
      .select("id")
      .eq("user_email", userEmail)
      .eq("song_id", song.id)
      .maybeSingle();

    if (existingError) {
      return NextResponse.json(
        { ok: false, error: existingError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      saved: Boolean(existing?.id)
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Server error" },
      { status: 500 }
    );
  }
}
