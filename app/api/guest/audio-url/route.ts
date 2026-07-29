import { NextRequest, NextResponse } from "next/server";
import { sha256, idempotencyKey } from "@/lib/crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { createSignedMediaUrl } from "@/lib/media";
export async function GET(req: NextRequest) {
  try {
    const token = new URL(req.url).searchParams.get("guestToken") || "";
    const guest = await supabaseAdmin.from("guest_sessions").select("id,status,expires_at").eq("guest_token_hash", sha256(token)).maybeSingle();
    if (!guest.data?.id || new Date(guest.data.expires_at).getTime() < Date.now()) return NextResponse.json({ ok:false, error:"Guest session expired." }, { status:401 });
    const ent = await supabaseAdmin.from("guest_one_play_entitlements").select("*,songs(id,slug,title,artist,audio_path)").eq("guest_session_id", guest.data.id).in("status", ["active", "started", "meaningful", "qualified"]).maybeSingle();
    if (!ent.data?.id || Number(ent.data.plays_used || 0) >= Number(ent.data.play_limit || 1)) return NextResponse.json({ ok:false, error:"Guest play has already been used." }, { status:403 });
    const song = Array.isArray(ent.data.songs) ? ent.data.songs[0] : ent.data.songs;
    const playbackUrl = await createSignedMediaUrl(song.audio_path);
    await supabaseAdmin.from("guest_one_play_entitlements").update({ status:"started", first_played_at: ent.data.first_played_at || new Date().toISOString(), last_played_at:new Date().toISOString() }).eq("id", ent.data.id);
    await supabaseAdmin.from("playback_sessions").upsert({ guest_session_id:guest.data.id, song_id:song.id, project_id:ent.data.project_id, share_session_id:ent.data.share_session_id, guest_entitlement_id:ent.data.id, access_mode:"nearby_guest_one_play", is_preview:false, qualification_status:"pending", idempotency_key:idempotencyKey(["guest_playback", ent.data.id]) }, { onConflict:"idempotency_key" });
    return NextResponse.json({ ok:true, playbackUrl, song: { id:song.id, slug:song.slug, title:song.title, artist:song.artist } });
  } catch { return NextResponse.json({ ok:false, error:"Could not load guest play." }, { status:500 }); }
}
