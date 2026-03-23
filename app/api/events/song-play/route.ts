import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const userEmail = body.userEmail ? String(body.userEmail).toLowerCase() : null;
    const songSlug = body.songSlug ? String(body.songSlug) : null;
    const sourcePath = body.sourcePath ? String(body.sourcePath) : null;

    if (!songSlug) {
      return NextResponse.json({ ok: false, error: "Missing songSlug" }, { status: 400 });
    }

    const { data: song, error: songError } = await supabaseAdmin
      .from("songs")
      .select("id")
      .eq("slug", songSlug)
      .single();

    if (songError || !song) {
      return NextResponse.json({ ok: false, error: "Song not found" }, { status: 404 });
    }

    const h = await headers();

    await supabaseAdmin.from("event_logs").insert({
      user_email: userEmail,
      event_type: "song_play",
      song_id: song.id,
      app_slug: "fartherhood",
      source_path: sourcePath,
      user_agent: h.get("user-agent"),
      country: h.get("x-vercel-ip-country"),
      region: h.get("x-vercel-ip-country-region"),
      city: h.get("x-vercel-ip-city"),
      metadata: {}
    });

    await supabaseAdmin.rpc("increment_song_play_stats", {
      p_user_email: userEmail,
      p_song_id: song.id,
      p_completed: false
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
