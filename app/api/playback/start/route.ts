import { NextRequest, NextResponse } from "next/server";
import { getCurrentAppUser } from "@/lib/users";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { resolveEffectiveAccess } from "@/lib/access/effective-access";
import { createSignedMediaUrl } from "@/lib/media";
import { idempotencyKey } from "@/lib/crypto";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentAppUser();
    const body = await req.json();
    const access = await resolveEffectiveAccess({ userId: user?.id, userEmail: user?.email, songId: body.songId, songSlug: body.songSlug });
    if (!access.allowed || !access.playbackPath) return NextResponse.json({ ok:false, error: access.blockedReason || "Playback unavailable." }, { status:403 });
    const url = await createSignedMediaUrl(access.playbackPath);
    const song = body.songId ? { id: body.songId } : (await supabaseAdmin.from("songs").select("id,project_id,app_id").eq("slug", body.songSlug).maybeSingle()).data;
    const key = idempotencyKey(["playback", user?.id || "anon", song?.id || body.songSlug, Date.now()]);
    const { data, error } = await supabaseAdmin.from("playback_sessions").insert({ user_id: user?.id || null, song_id: song?.id || body.songId || null, access_mode: access.accessType, is_preview: access.playbackMode === "preview", qualification_status:"pending", idempotency_key:key }).select("id").single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok:true, playbackUrl:url, playbackSessionId:data.id, access });
  } catch {
    return NextResponse.json({ ok:false, error:"Could not start playback." }, { status:500 });
  }
}
