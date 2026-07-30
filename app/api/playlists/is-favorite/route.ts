import { NextRequest, NextResponse } from "next/server";
import { getCurrentAppUser } from "@/lib/users";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(req: NextRequest) {
  const user = await getCurrentAppUser();
  if (!user) return NextResponse.json({ ok: true, saved: false });
  const params = new URL(req.url).searchParams;
  const songId = params.get("songId");
  const songSlug = params.get("songSlug");
  let resolvedSongId = songId;
  if (!resolvedSongId && songSlug) {
    const song = await supabaseAdmin.from("songs").select("id").eq("slug", songSlug).maybeSingle();
    resolvedSongId = song.data?.id || null;
  }
  if (!resolvedSongId) return NextResponse.json({ ok: true, saved: false });
  const row = await supabaseAdmin.from("user_favorite_songs").select("id,status").or(`user_id.eq.${user.id},user_email.eq.${user.email}`).eq("song_id", resolvedSongId).neq("status", "removed").maybeSingle();
  return NextResponse.json({ ok: true, saved: Boolean(row.data?.id) });
}
