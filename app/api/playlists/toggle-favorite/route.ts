import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const userEmail = String(body.userEmail || "").trim().toLowerCase();
    const songSlug = String(body.songSlug || "").trim();

    if (!userEmail || !songSlug) {
      return NextResponse.json(
        { ok: false, error: "Missing fields" },
        { status: 400 }
      );
    }

    const { data: song, error: songError } = await supabaseAdmin
      .from("songs")
      .select("id, slug, source_app_slug")
      .eq("slug", songSlug)
      .single();

    if (songError || !song) {
      return NextResponse.json(
        { ok: false, error: "Song not found" },
        { status: 404 }
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

    if (existing?.id) {
      const { error: deleteError } = await supabaseAdmin
        .from("user_favorite_songs")
        .delete()
        .eq("id", existing.id);

      if (deleteError) {
        return NextResponse.json(
          { ok: false, error: deleteError.message },
          { status: 500 }
        );
      }

      const { error: logError } = await supabaseAdmin
        .from("event_logs")
        .insert({
          user_email: userEmail,
          event_type: "playlist_remove",
          song_id: song.id,
          song_slug: song.slug,
          app_slug: song.source_app_slug || null,
          metadata: {
            song_slug: song.slug
          }
        });

      if (logError) {
        return NextResponse.json(
          { ok: false, error: logError.message },
          { status: 500 }
        );
      }

      return NextResponse.json({ ok: true, saved: false });
    }

    const { error: insertError } = await supabaseAdmin
      .from("user_favorite_songs")
      .insert({
        user_email: userEmail,
        song_id: song.id,
        song_slug: song.slug
      });

    if (insertError) {
      return NextResponse.json(
        { ok: false, error: insertError.message },
        { status: 500 }
      );
    }

    const { error: logError } = await supabaseAdmin
      .from("event_logs")
      .insert({
        user_email: userEmail,
        event_type: "playlist_add",
        song_id: song.id,
        song_slug: song.slug,
        app_slug: song.source_app_slug || null,
        metadata: {
          song_slug: song.slug
        }
      });

    if (logError) {
      return NextResponse.json(
        { ok: false, error: logError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, saved: true });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Server error" },
      { status: 500 }
    );
  }
}
