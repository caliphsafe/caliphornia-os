import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body.playbackSessionId) return NextResponse.json({ ok:false }, { status:400 });
  await supabaseAdmin.from("playback_sessions").update({ last_heartbeat_at:new Date().toISOString(), seconds_played: Math.max(0, Number(body.secondsPlayed || 0)) }).eq("id", body.playbackSessionId);
  return NextResponse.json({ ok:true });
}
