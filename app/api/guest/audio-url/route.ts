import { NextRequest, NextResponse } from "next/server";
import { sha256, idempotencyKey } from "@/lib/crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { createSignedMediaUrl } from "@/lib/media";

function firstRow(value: any) {
  if (Array.isArray(value)) return value[0] || null;
  return value || null;
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("guestToken") || "";
    const requestedSongId = url.searchParams.get("songId") || "";
    const requestedEntitlementId = url.searchParams.get("entitlementId") || "";

    const guest = await supabaseAdmin
      .from("guest_sessions")
      .select("id,status,expires_at")
      .eq("guest_token_hash", sha256(token))
      .maybeSingle();

    if (!guest.data?.id || new Date(guest.data.expires_at).getTime() <= Date.now()) {
      return NextResponse.json({ ok: false, error: "Guest session expired." }, { status: 401 });
    }

    const entitlementsRes = await supabaseAdmin
      .from("guest_one_play_entitlements")
      .select("*,songs(id,slug,title,artist_name,audio_path)")
      .eq("guest_session_id", guest.data.id)
      .in("status", ["active", "started", "meaningful", "qualified"])
      .order("created_at", { ascending: true });

    const entitlements = (entitlementsRes.data || [])
      .map((entitlement: any) => ({ ...entitlement, song: firstRow(entitlement.songs) }))
      .filter((entitlement: any) => entitlement.song?.id);

    if (!entitlements.length) {
      return NextResponse.json({ ok: false, error: "Guest play has already been used or expired." }, { status: 403 });
    }

    const playable = entitlements.filter((entitlement: any) => {
      const used = Number(entitlement.plays_used || 0);
      const limit = Number(entitlement.play_limit || 1);
      return used < limit && (!entitlement.expires_at || new Date(entitlement.expires_at).getTime() > Date.now());
    });

    if (!playable.length) {
      return NextResponse.json({ ok: false, error: "All guest plays have been used." }, { status: 403 });
    }

    const selected =
      playable.find((entitlement: any) => requestedEntitlementId && entitlement.id === requestedEntitlementId) ||
      playable.find((entitlement: any) => requestedSongId && entitlement.song_id === requestedSongId) ||
      playable[0];

    const song = selected.song;

    if (!song.audio_path) {
      return NextResponse.json(
        {
          ok: false,
          error: `Audio is missing for ${song.title || song.slug}. Add a valid songs.audio_path for this song.`,
        },
        { status: 404 }
      );
    }

    const playbackUrl = await createSignedMediaUrl(song.audio_path);

    await supabaseAdmin
      .from("guest_one_play_entitlements")
      .update({
        status: "started",
        first_played_at: selected.first_played_at || new Date().toISOString(),
        last_played_at: new Date().toISOString(),
      })
      .eq("id", selected.id);

    await supabaseAdmin.from("playback_sessions").upsert(
      {
        guest_session_id: guest.data.id,
        song_id: song.id,
        project_id: selected.project_id,
        share_session_id: selected.share_session_id,
        guest_entitlement_id: selected.id,
        access_mode: "nearby_guest_one_play",
        is_preview: false,
        qualification_status: "pending",
        idempotency_key: idempotencyKey(["guest_playback", selected.id]),
      },
      { onConflict: "idempotency_key" }
    );

    return NextResponse.json({
      ok: true,
      playbackUrl,
      entitlementId: selected.id,
      song: {
        id: song.id,
        slug: song.slug,
        title: song.title,
        artist: song.artist_name || "Caliph",
      },
      playlist: entitlements.map((entitlement: any) => ({
        entitlementId: entitlement.id,
        songId: entitlement.song.id,
        slug: entitlement.song.slug,
        title: entitlement.song.title,
        artist: entitlement.song.artist_name || "Caliph",
        status: entitlement.status,
        used: Number(entitlement.plays_used || 0) >= Number(entitlement.play_limit || 1),
      })),
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Could not load guest play." },
      { status: 500 }
    );
  }
}
