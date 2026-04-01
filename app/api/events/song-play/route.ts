import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const userEmail = body.userEmail ? String(body.userEmail).toLowerCase() : null;
    const songSlug = body.songSlug ? String(body.songSlug).trim() : null;
    const sourcePath = body.sourcePath ? String(body.sourcePath) : null;
    const sourceApp = body.sourceApp ? String(body.sourceApp).trim() : null;

    if (!songSlug) {
      return NextResponse.json(
        { ok: false, error: "Missing songSlug" },
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

    const h = await headers();

    const resolvedAppSlug =
      sourceApp ||
      song.source_app_slug ||
      (sourcePath?.startsWith("/apps/milia")
        ? "milia"
        : sourcePath?.startsWith("/apps/friends")
          ? "friends"
          : sourcePath?.startsWith("/apps/fartherhood")
            ? "fartherhood"
            : sourcePath?.startsWith("/apps/music")
              ? "music"
              : null);

        const { error: logError } = await supabaseAdmin
      .from("event_logs")
      .insert({
        user_email: userEmail,
        event_type: "song_play",
        song_id: song.id,
        song_slug: song.slug,
        app_slug: resolvedAppSlug,
        source_path: sourcePath,
        user_agent: h.get("user-agent"),
        country: h.get("x-vercel-ip-country"),
        region: h.get("x-vercel-ip-country-region"),
        city: h.get("x-vercel-ip-city"),
        metadata: {
          song_slug: song.slug
        }
      });

    if (logError) {
      console.error("event_logs insert failed:", logError);
      return NextResponse.json(
        { ok: false, error: logError.message },
        { status: 500 }
      );
    }

    const { error: rpcError } = await supabaseAdmin.rpc("increment_song_play_stats", {
      p_user_email: userEmail,
      p_song_id: song.id,
      p_completed: false
    });

    if (rpcError) {
      console.error("increment_song_play_stats failed:", rpcError);
      return NextResponse.json(
        { ok: false, error: rpcError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("song-play route error:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Server error" },
      { status: 500 }
    );
  }
}
