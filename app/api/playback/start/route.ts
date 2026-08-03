import { NextRequest, NextResponse } from "next/server";
import { getCurrentAppUser } from "@/lib/users";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { resolveEffectiveAccess } from "@/lib/access/effective-access";
import { createSignedMediaUrl } from "@/lib/media";
import { idempotencyKey } from "@/lib/crypto";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentAppUser();
    const body = await req.json().catch(() => ({}));

    const songId = body.songId ? String(body.songId) : null;
    const songSlug = body.songSlug ? String(body.songSlug) : null;

    if (!songId && !songSlug) {
      return NextResponse.json(
        { ok: false, error: "Song ID or slug is required." },
        { status: 400 },
      );
    }

    const access = await resolveEffectiveAccess({
      userId: user?.id,
      userEmail: user?.email,
      songId,
      songSlug,
      requestedAction: "play",
    });

    if (!access.allowed || !access.playbackPath) {
      return NextResponse.json(
        {
          ok: false,
          error:
            access.blockedReason ||
            "Playback is unavailable for this song.",
        },
        { status: 403 },
      );
    }

    /*
     * The audited database stores object paths such as
     * milia/outside/outside-final.mp3 inside the private `songs` bucket.
     * createSignedMediaUrl already resolves that exact contract.
     */
    const playbackUrl = await createSignedMediaUrl(
      access.playbackPath,
    );

    const songResult = songId
      ? await supabaseAdmin
          .from("songs")
          .select("id,project_id,app_id")
          .eq("id", songId)
          .maybeSingle()
      : await supabaseAdmin
          .from("songs")
          .select("id,project_id,app_id")
          .eq("slug", songSlug || "")
          .maybeSingle();

    if (songResult.error) {
      throw new Error(songResult.error.message);
    }

    const song = songResult.data;
    let playbackSessionId: string | null = null;

    /*
     * Playback logging is important, but it must never prevent valid audio
     * from starting. The signed URL is returned even if analytics insertion
     * fails for an older or partially migrated playback_sessions table.
     */
    if (song?.id) {
      const key = idempotencyKey([
        "playback",
        user?.id || "anon",
        song.id,
        Date.now(),
      ]);

      const sessionResult = await supabaseAdmin
        .from("playback_sessions")
        .insert({
          user_id: user?.id || null,
          song_id: song.id,
          project_id: song.project_id || null,
          app_id: song.app_id || null,
          access_mode: access.accessType,
          is_preview: access.playbackMode === "preview",
          qualification_status: "pending",
          idempotency_key: key,
        })
        .select("id")
        .maybeSingle();

      if (!sessionResult.error) {
        playbackSessionId = sessionResult.data?.id || null;
      }
    }

    return NextResponse.json({
      ok: true,
      playbackUrl,
      playbackSessionId,
      access,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Could not start playback.",
      },
      { status: 500 },
    );
  }
}
