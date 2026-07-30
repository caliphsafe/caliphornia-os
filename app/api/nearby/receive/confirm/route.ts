import { NextRequest, NextResponse } from "next/server";
import { sha256, idempotencyKey } from "@/lib/crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";

function normalizeSongIds(share: any) {
  const fromMetadata = Array.isArray(share?.metadata?.share_song_ids)
    ? share.metadata.share_song_ids
    : [];

  return Array.from(
    new Set(
      [...fromMetadata, share?.song_id]
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    )
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const guest = await supabaseAdmin
      .from("guest_sessions")
      .select("id")
      .eq("guest_token_hash", sha256(String(body.guestToken || "")))
      .maybeSingle();

    if (!guest.data?.id) {
      return NextResponse.json(
        { ok: false, error: "Receive session expired." },
        { status: 401 }
      );
    }

    const share = await supabaseAdmin
      .from("nearby_share_sessions")
      .select("*")
      .eq("id", body.shareSessionId)
      .eq("status", "searching")
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (!share.data?.id) {
      return NextResponse.json(
        { ok: false, error: "Share expired or already accepted." },
        { status: 404 }
      );
    }

    const songIds = normalizeSongIds(share.data);

    if (!songIds.length) {
      return NextResponse.json(
        { ok: false, error: "This Share has no songs attached." },
        { status: 404 }
      );
    }

    await supabaseAdmin
      .from("nearby_share_sessions")
      .update({
        recipient_guest_session_id: guest.data.id,
        recipient_confirmed_at: new Date().toISOString(),
        accepted_at: new Date().toISOString(),
        status: "accepted",
        metadata: {
          ...(share.data.metadata || {}),
          receiver_flow: "main_page_proximity",
          receiver_location:
            body.location && typeof body.location === "object"
              ? {
                  lat: Number(body.location.latitude || body.location.lat || 0),
                  lng: Number(body.location.longitude || body.location.lng || 0),
                  accuracy: Number(body.location.accuracy || 0) || null,
                  captured_at: new Date().toISOString(),
                  precision: "rounded_by_browser",
                }
              : null,
        },
      })
      .eq("id", share.data.id);

    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    const entitlementRows = await Promise.all(
      songIds.map((songId) =>
        supabaseAdmin
          .from("guest_one_play_entitlements")
          .upsert(
            {
              guest_session_id: guest.data.id,
              share_session_id: share.data.id,
              song_id: songId,
              project_id: share.data.project_id || null,
              play_limit: 1,
              plays_used: 0,
              status: "active",
              expires_at: expiresAt,
              idempotency_key: idempotencyKey([
                "guest_entitlement",
                share.data.id,
                guest.data.id,
                songId,
              ]),
            },
            { onConflict: "idempotency_key" }
          )
          .select("id")
          .single()
      )
    );

    await supabaseAdmin.from("nearby_share_events").insert({
      share_session_id: share.data.id,
      actor_guest_session_id: guest.data.id,
      event_type:
        share.data.share_scope === "project"
          ? "project_share_accepted"
          : "song_share_accepted",
      event_status: "ok",
      metadata: {
        song_count: songIds.length,
        receiver_flow: "main_page_proximity",
      },
    });

    return NextResponse.json({
      ok: true,
      guestEntitlementIds: entitlementRows
        .map((row) => row.data?.id)
        .filter(Boolean),
      guestUrl: `/guest/${encodeURIComponent(body.guestToken)}`,
      songCount: songIds.length,
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Could not accept Share." },
      { status: 500 }
    );
  }
}
