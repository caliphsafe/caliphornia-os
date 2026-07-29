import { NextRequest, NextResponse } from "next/server";
import { requireCurrentAppUser } from "@/lib/users";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { resolveEffectiveAccess } from "@/lib/access/effective-access";
import { createPhrase, createTokenPair } from "@/lib/sharing/tokens";
import { sha256 } from "@/lib/crypto";
import { reserveAllowance } from "@/lib/sharing/allowances";

export async function POST(req: NextRequest) {
  try {
    const user = await requireCurrentAppUser();
    const body = await req.json();
    const song = await supabaseAdmin.from("songs").select("id,slug,title,project_id,app_id").eq("slug", String(body.songSlug || "")).maybeSingle();
    if (!song.data?.id) return NextResponse.json({ ok:false, error:"Song not found." }, { status:404 });
    const access = await resolveEffectiveAccess({ userId:user.id, userEmail:user.email, songId:song.data.id, requestedAction:"share" });
    if (!access.sharingEligible || access.sharesRemaining <= 0) return NextResponse.json({ ok:false, error:"No Nearby Shares available for this song." }, { status:403 });
    const { token, tokenHash } = createTokenPair();
    const phrase = createPhrase();
    const expires = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    const inserted = await supabaseAdmin.from("nearby_share_sessions").insert({ sender_user_id:user.id, song_id:song.data.id, project_id:song.data.project_id, app_id:song.data.app_id, share_token_hash:tokenHash, fallback_phrase_hash:sha256(phrase), status:"searching", share_scope:"song", share_method_snapshot:"nearby", song_slug_snapshot:song.data.slug, song_title_snapshot:song.data.title, sender_email_snapshot:user.email, expires_at:expires, location_data_delete_at:expires, metadata:{ sender_label: user.username ? `${user.username}'s device` : "Nearby listener" } }).select("id").single();
    if (inserted.error) throw new Error(inserted.error.message);
    const allowance = await reserveAllowance({ userId:user.id, songId:song.data.id, projectId:song.data.project_id, sessionId:inserted.data.id });
    if (allowance?.id) await supabaseAdmin.from("nearby_share_sessions").update({ allowance_id:allowance.id }).eq("id", inserted.data.id);
    await supabaseAdmin.from("nearby_share_events").insert({ share_session_id:inserted.data.id, actor_user_id:user.id, event_type:"share_created", event_status:"ok", metadata:{} });
    return NextResponse.json({ ok:true, shareSessionId:inserted.data.id, shareToken:token, phrase, expiresAt:expires });
  } catch {
    return NextResponse.json({ ok:false, error:"Could not start Nearby Share." }, { status:500 });
  }
}
