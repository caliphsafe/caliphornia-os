import { NextRequest, NextResponse } from "next/server";
import { sha256, normalizeEmail, idempotencyKey } from "@/lib/crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getOrCreateAppUser } from "@/lib/users";
import { setSessionCookie } from "@/lib/session";
import { createKiikuTransaction } from "@/lib/kiiku/ledger";
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = normalizeEmail(String(body.email || ""));
    const guest = await supabaseAdmin.from("guest_sessions").select("id,claimed_by_user_id").eq("guest_token_hash", sha256(String(body.guestToken || ""))).maybeSingle();
    if (!guest.data?.id) return NextResponse.json({ ok:false, error:"Guest session expired." }, { status:401 });
    const code = await supabaseAdmin.from("guest_claim_codes").select("*").eq("guest_session_id", guest.data.id).eq("email", email).eq("status", "active").gt("expires_at", new Date().toISOString()).order("created_at", { ascending:false }).limit(1).maybeSingle();
    if (!code.data || code.data.code_hash !== sha256(String(body.code || ""))) return NextResponse.json({ ok:false, error:"Code did not match." }, { status:400 });
    const user = await getOrCreateAppUser(email);
    await supabaseAdmin.from("guest_claim_codes").update({ status:"used", used_at:new Date().toISOString() }).eq("id", code.data.id);
    await supabaseAdmin.from("guest_sessions").update({ status:"claimed", claimed_at:new Date().toISOString(), claimed_by_user_id:user.id }).eq("id", guest.data.id);
    const ent = await supabaseAdmin.from("guest_one_play_entitlements").select("*").eq("guest_session_id", guest.data.id).maybeSingle();
    if (ent.data?.song_id) {
      const song = await supabaseAdmin.from("songs").select("id,slug").eq("id", ent.data.song_id).maybeSingle();
      await supabaseAdmin.from("user_favorite_songs").upsert({ user_id:user.id, user_email:user.email, song_id:ent.data.song_id, song_slug:song.data?.slug || null, source_type:"share_claim", source_access_table:"guest_one_play_entitlements", source_access_id:ent.data.id, status:"active" }, { onConflict:"user_id,song_id" });
      await supabaseAdmin.from("guest_one_play_entitlements").update({ status:"claimed", claimed_at:new Date().toISOString(), claimed_by_user_id:user.id }).eq("id", ent.data.id);
    }
    const share = ent.data?.share_session_id ? await supabaseAdmin.from("nearby_share_sessions").select("id,sender_user_id,project_id,song_id").eq("id", ent.data.share_session_id).maybeSingle() : { data:null } as any;
    await supabaseAdmin.from("guest_account_claims").upsert({ guest_session_id:guest.data.id, user_id:user.id, share_session_id:share.data?.id || null, claim_method:"email_code", status:"completed", claimed_email_snapshot:email, completed_at:new Date().toISOString(), idempotency_key:idempotencyKey(["guest_claim", guest.data.id, user.id]) }, { onConflict:"idempotency_key" });
    const rule = await supabaseAdmin.from("kiiku_rules").select("*").eq("status","active").eq("action_type","guest_account_claim").limit(1).maybeSingle();
    const amount = Number(rule.data?.credit_amount || 0);
    if (amount > 0) await createKiikuTransaction({ userId:user.id, amount, direction:"earn", transactionType:"welcome_reward", reason:"Guest account claim", idempotencyKey:idempotencyKey(["kiiku_guest_claim", guest.data.id, rule.data.id]), ruleId:rule.data.id, shareSessionId:share.data?.id || null, projectId:share.data?.project_id || null, songId:share.data?.song_id || null });
    await setSessionCookie({ email:user.email, username:user.username || undefined, role:user.role || undefined, iat:Date.now() });
    return NextResponse.json({ ok:true });
  } catch { return NextResponse.json({ ok:false, error:"Could not claim guest session." }, { status:500 }); }
}
