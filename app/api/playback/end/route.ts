import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { idempotencyKey } from "@/lib/crypto";
export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body.playbackSessionId) return NextResponse.json({ ok:false }, { status:400 });
  const session = await supabaseAdmin.from("playback_sessions").select("*").eq("id", body.playbackSessionId).maybeSingle();
  await supabaseAdmin.from("playback_sessions").update({ ended_at:new Date().toISOString(), qualification_status:"qualified", qualified_at:new Date().toISOString() }).eq("id", body.playbackSessionId);
  if (session.data?.song_id) {
    await supabaseAdmin.from("qualified_listens").upsert({ playback_session_id: body.playbackSessionId, user_id: session.data.user_id, guest_session_id: session.data.guest_session_id, song_id: session.data.song_id, project_id: session.data.project_id, share_session_id: session.data.share_session_id, qualification_rule:"default", status:"qualified", qualified_at:new Date().toISOString(), idempotency_key:idempotencyKey(["qualified_listen", body.playbackSessionId]) }, { onConflict:"idempotency_key" });
  }
  return NextResponse.json({ ok:true });
}
