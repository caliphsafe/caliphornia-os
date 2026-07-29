import { NextRequest, NextResponse } from "next/server";
import { sha256, idempotencyKey } from "@/lib/crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { createKiikuTransaction } from "@/lib/kiiku/ledger";
import { consumeAllowance } from "@/lib/sharing/allowances";
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const guest = await supabaseAdmin.from("guest_sessions").select("id").eq("guest_token_hash", sha256(String(body.guestToken || ""))).maybeSingle();
    if (!guest.data?.id) return NextResponse.json({ ok:false }, { status:401 });
    const ent = await supabaseAdmin.from("guest_one_play_entitlements").select("*").eq("guest_session_id", guest.data.id).maybeSingle();
    if (!ent.data?.id) return NextResponse.json({ ok:false }, { status:404 });
    await supabaseAdmin.from("guest_one_play_entitlements").update({ status:"consumed", plays_used:1, last_played_at:new Date().toISOString() }).eq("id", ent.data.id);
    const share = await supabaseAdmin.from("nearby_share_sessions").select("*").eq("id", ent.data.share_session_id).maybeSingle();
    await supabaseAdmin.from("playback_sessions").update({ ended_at:new Date().toISOString(), qualified_at:new Date().toISOString(), qualification_status:"qualified" }).eq("guest_entitlement_id", ent.data.id);
    const playback = await supabaseAdmin.from("playback_sessions").select("id").eq("guest_entitlement_id", ent.data.id).maybeSingle();
    if (playback.data?.id) await supabaseAdmin.from("qualified_listens").upsert({ playback_session_id:playback.data.id, guest_session_id:guest.data.id, song_id:ent.data.song_id, project_id:ent.data.project_id, share_session_id:ent.data.share_session_id, qualification_rule:"guest_complete", status:"qualified", qualified_at:new Date().toISOString(), idempotency_key:idempotencyKey(["qualified_guest_listen", playback.data.id]) }, { onConflict:"idempotency_key" });
    if (share.data?.id) {
      const q = await supabaseAdmin.from("share_qualifications").upsert({ share_session_id:share.data.id, sender_user_id:share.data.sender_user_id, recipient_guest_session_id:guest.data.id, song_id:ent.data.song_id, project_id:ent.data.project_id, playback_session_id:playback.data?.id || null, status:"qualified", qualified_at:new Date().toISOString(), idempotency_key:idempotencyKey(["share_qualification", share.data.id]) }, { onConflict:"idempotency_key" }).select("*").single();
      await supabaseAdmin.from("nearby_share_sessions").update({ status:"qualified", qualified_at:new Date().toISOString(), qualified_share_id:q.data?.id || null }).eq("id", share.data.id);
      if (share.data.allowance_id) await consumeAllowance(share.data.allowance_id);
      const rule = await supabaseAdmin.from("kiiku_rules").select("*").eq("status","active").eq("action_type","qualified_share").limit(1).maybeSingle();
      const amount = Number(rule.data?.credit_amount || 0);
      if (amount > 0 && share.data.sender_user_id) await createKiikuTransaction({ userId:share.data.sender_user_id, amount, direction:"earn", transactionType:"share_reward", status: rule.data?.pending_period_hours ? "pending" : "approved", reason:"Qualified Nearby Share", idempotencyKey:idempotencyKey(["kiiku_share", share.data.id, rule.data.id]), ruleId:rule.data.id, shareSessionId:share.data.id, projectId:ent.data.project_id, songId:ent.data.song_id });
    }
    return NextResponse.json({ ok:true });
  } catch { return NextResponse.json({ ok:false, error:"Could not complete guest play." }, { status:500 }); }
}
