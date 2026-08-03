import { NextRequest, NextResponse } from "next/server";
import { idempotencyKey } from "@/lib/crypto";
import { resolveEffectiveAccess } from "@/lib/access/effective-access";
import { createSignedMediaUrl } from "@/lib/media";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentAppUser } from "@/lib/users";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentAppUser();
    const body = await req.json().catch(() => ({}));

    const songId = body.songId
      ? String(body.songId)
      : null;
    const songSlug = body.songSlug
      ? String(body.songSlug)
      : null;

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

    const playbackUrl = await createSignedMediaUrl(
      access.playbackPath,
    );

    const songResult = songId
      ? await supabaseAdmin
          .from("songs")
          .select("id, project_id, app_id")
          .eq("id", songId)
          .maybeSingle()
      : await supabaseAdmin
          .from("songs")
          .select("id, project_id, app_id")
          .eq("slug", songSlug || "")
          .maybeSingle();

    const resolvedSongId =
      songResult.data?.id || songId || null;

    /*
     * Analytics must never prevent music from playing. Playback is returned
     * even when an older database is missing a playback_sessions field.
     */
    let playbackSessionId: string | null = null;

    if (resolvedSongId) {
      const key = idempotencyKey([
        "playback",
        user?.id || "anon",
        resolvedSongId,
        Date.now(),
      ]);

      const sessionResult = await supabaseAdmin
        .from("playback_sessions")
        .insert({
          user_id: user?.id || null,
          song_id: resolvedSongId,
          access_mode: access.accessType,
          is_preview: access.playbackMode === "preview",
          qualification_status: "pending",
          idempotency_key: key,
        })
        .select("id")
        .maybeSingle();

      if (!sessionResult.error) {
        playbackSessionId =
          sessionResult.data?.id || null;
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
