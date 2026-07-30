import { NextRequest, NextResponse } from "next/server";
import { sha256, idempotencyKey } from "@/lib/crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";

async function loadProjectSongIds(share: any) {
  const metadataIds = Array.isArray(share.metadata?.share_song_ids)
    ? share.metadata.share_song_ids.filter(Boolean).map(String)
    : [];

  if (metadataIds.length) return metadataIds;

  if (share.share_scope === "project" && share.project_id) {
    const songs = await supabaseAdmin
      .from("songs")
      .select("id")
      .eq("project_id", share.project_id)
      .neq("status", "archived")
      .order("position", { ascending: true });
    return (songs.data || []).map((song: any) => song.id).filter(Boolean);
  }

  return share.song_id ? [share.song_id] : [];
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
      return NextResponse.json({ ok: false, error: "Receive session expired." }, { status: 401 });
    }

    const share = await supabaseAdmin
      .from("nearby_share_sessions")
      .select("*")
      .eq("id", body.shareSessionId)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (!share.data?.id) {
      return NextResponse.json({ ok: false, error: "Share expired." }, { status: 404 });
    }

    const songIds = await loadProjectSongIds(share.data);
    if (!songIds.length) {
      return NextResponse.json({ ok: false, error: "This Share has no songs attached." }, { status: 404 });
    }

    await supabaseAdmin
      .from("nearby_share_sessions")
      .update({
        recipient_guest_session_id: guest.data.id,
        recipient_confirmed_at: new Date().toISOString(),
        accepted_at: new Date().toISOString(),
        status: "accepted",
      })
      .eq("id", share.data.id);

    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const entitlements = [];

    for (const songId of songIds) {
      const ent = await supabaseAdmin
        .from("guest_one_play_entitlements")
        .upsert(
          {
            guest_session_id: guest.data.id,
            share_session_id: share.data.id,
            song_id: songId,
            project_id: share.data.project_id,
            play_limit: 1,
            plays_used: 0,
            status: "active",
            expires_at: expiresAt,
            metadata: {
              share_scope: share.data.share_scope || "song",
              project_name_snapshot: share.data.project_name_snapshot || null,
            },
            idempotency_key: idempotencyKey(["guest_entitlement", share.data.id, guest.data.id, songId]),
          },
          { onConflict: "idempotency_key" }
        )
        .select("id,song_id")
        .single();

      if (ent.data?.id) entitlements.push(ent.data);
    }

    await supabaseAdmin.from("nearby_share_events").insert({
      share_session_id: share.data.id,
      actor_guest_session_id: guest.data.id,
      event_type: share.data.share_scope === "project" ? "project_share_accepted" : "song_share_accepted",
      event_status: "ok",
      metadata: { entitlement_count: entitlements.length },
    });

    return NextResponse.json({
      ok: true,
      guestEntitlementIds: entitlements.map((entitlement) => entitlement.id),
      guestUrl: `/guest/${encodeURIComponent(body.guestToken)}`,
      scope: share.data.share_scope || "song",
      songCount: entitlements.length,
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Could not accept Share." },
      { status: 500 }
    );
  }
}
