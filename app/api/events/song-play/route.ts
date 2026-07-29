import { NextRequest, NextResponse } from "next/server";
import { getCurrentAppUser } from "@/lib/users";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { idempotencyKey } from "@/lib/crypto";
export async function POST(req: NextRequest) {
  const user = await getCurrentAppUser();
  const body = await req.json().catch(()=>({}));
  await supabaseAdmin.from("event_logs").insert({ event_type:"song_play", user_id:user?.id || null, user_email:user?.email || null, song_id:body.songId || null, song_slug:body.songSlug || null, app_slug:body.appSlug || null, privacy_level:"reduced", qualification_status:"pending", idempotency_key:idempotencyKey(["event_song_play", user?.id || "anon", body.songId || body.songSlug, Date.now()]), metadata:{} });
  return NextResponse.json({ ok:true });
}
