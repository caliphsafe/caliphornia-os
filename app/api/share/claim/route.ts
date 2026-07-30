import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sha256, idempotencyKey } from "@/lib/crypto";
import { createTokenPair } from "@/lib/sharing/tokens";

function asStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item || "").trim()).filter(Boolean);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const shareToken = String(body.shareToken || body.share || "").trim();

    if (!shareToken) {
      return NextResponse.json(
        { ok: false, error: "Share link is missing." },
        { status: 400 }
      );
    }

    const tokenHash = sha256(shareToken);
    const now = new Date().toISOString();

    const shareRes = await supabaseAdmin
      .from("nearby_share_sessions")
      .select("*")
      .eq("share_token_hash", tokenHash)
      .gt("expires_at", now)
      .maybeSingle();

    if (shareRes.error) throw new Error(shareRes.error.message);

    const share = shareRes.data as Record<string, any> | null;

    if (!share?.id) {
      return NextResponse.json(
        { ok: false, error: "This Share link has expired or could not be found." },
        { status: 404 }
      );
    }

    if (share.status && !["searching", "created", "pending"].includes(String(share.status))) {
      return NextResponse.json(
        {
          ok: false,
          error: "This Share has already been accepted. Ask the sender to start a new Share.",
        },
        { status: 409 }
      );
    }

    const { token: guestToken, tokenHash: guestTokenHash } = createTokenPair();
    const guestExpiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    const guestRes = await supabaseAdmin
      .from("guest_sessions")
      .insert({
        guest_token_hash: guestTokenHash,
        status: "active",
        expires_at: guestExpiresAt,
        privacy_level: "reduced",
        metadata: {
          entry: "public_share_link",
          share_session_id: share.id,
        },
      })
      .select("id")
      .single();

    if (guestRes.error) throw new Error(guestRes.error.message);

    const guestId = guestRes.data.id;
    const metadata = (share.metadata || {}) as Record<string, unknown>;
    const metadataSongIds = asStringArray(metadata.share_song_ids);
    const metadataSongTitles = asStringArray(metadata.share_song_titles);
    const songIds = Array.from(new Set(metadataSongIds.length ? metadataSongIds : [String(share.song_id || "")].filter(Boolean)));

    if (!songIds.length) {
      return NextResponse.json(
        { ok: false, error: "This Share does not have any songs attached yet." },
        { status: 404 }
      );
    }

    const entitlementRows = songIds.map((songId) => ({
      guest_session_id: guestId,
      share_session_id: share.id,
      song_id: songId,
      project_id: share.project_id || null,
      play_limit: 1,
      plays_used: 0,
      status: "active",
      expires_at: guestExpiresAt,
      idempotency_key: idempotencyKey(["guest_entitlement", share.id, guestId, songId]),
    }));

    const entRes = await supabaseAdmin
      .from("guest_one_play_entitlements")
      .upsert(entitlementRows, { onConflict: "idempotency_key" })
      .select("id");

    if (entRes.error) throw new Error(entRes.error.message);

    await supabaseAdmin
      .from("nearby_share_sessions")
      .update({
        recipient_guest_session_id: guestId,
        recipient_confirmed_at: now,
        accepted_at: now,
        status: "accepted",
      })
      .eq("id", share.id);

    await supabaseAdmin.from("nearby_share_events").insert({
      share_session_id: share.id,
      actor_guest_session_id: guestId,
      event_type: "public_share_link_accepted",
      event_status: "ok",
      metadata: {
        song_count: songIds.length,
        source: "unlock_page",
      },
    });

    return NextResponse.json({
      ok: true,
      guestToken,
      guestUrl: `/guest/${encodeURIComponent(guestToken)}`,
      songCount: songIds.length,
      scope: share.share_scope || (songIds.length > 1 ? "project" : "song"),
      title:
        share.project_name_snapshot ||
        share.song_title_snapshot ||
        metadataSongTitles[0] ||
        "Shared listening",
      expiresAt: guestExpiresAt,
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Could not activate this Share." },
      { status: 500 }
    );
  }
}
