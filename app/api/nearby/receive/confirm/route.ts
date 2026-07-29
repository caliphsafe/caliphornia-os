import { NextRequest, NextResponse } from "next/server";
import { sha256, idempotencyKey } from "@/lib/crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const guest = await supabaseAdmin.from("guest_sessions").select("id").eq("guest_token_hash", sha256(String(body.guestToken || ""))).maybeSingle();
    if (!guest.data?.id) return NextResponse.json({ ok:false, error:"Receive session expired." }, { status:401 });
    const share = await supabaseAdmin.from("nearby_share_sessions").select("*").eq("id", body.shareSessionId).gt("expires_at", new Date().toISOString()).maybeSingle();
    if (!share.data?.id) return NextResponse.json({ ok:false, error:"Share expired." }, { status:404 });
    await supabaseAdmin.from("nearby_share_sessions").update({ recipient_guest_session_id:guest.data.id, recipient_confirmed_at:new Date().toISOString(), accepted_at:new Date().toISOString(), status:"accepted" }).eq("id", share.data.id);
    const ent = await supabaseAdmin.from("guest_one_play_entitlements").upsert({ guest_session_id:guest.data.id, share_session_id:share.data.id, song_id:share.data.song_id, project_id:share.data.project_id, play_limit:1, plays_used:0, status:"active", expires_at:new Date(Date.now()+60*60*1000).toISOString(), idempotency_key:idempotencyKey(["guest_entitlement", share.data.id, guest.data.id]) }, { onConflict:"idempotency_key" }).select("id").single();
    await supabaseAdmin.from("nearby_share_events").insert({ share_session_id:share.data.id, actor_guest_session_id:guest.data.id, event_type:"accepted", event_status:"ok", metadata:{} });
    return NextResponse.json({ ok:true, guestEntitlementId:ent.data?.id, guestUrl:`/guest/${encodeURIComponent(body.guestToken)}` });
  } catch {
    return NextResponse.json({ ok:false, error:"Could not accept share." }, { status:500 });
  }
}
