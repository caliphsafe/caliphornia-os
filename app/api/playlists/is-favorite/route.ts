import { NextRequest, NextResponse } from "next/server";
import { getCurrentAppUser } from "@/lib/users";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(req: NextRequest) {
  const user = await getCurrentAppUser();
  if (!user) return NextResponse.json({ ok: true, saved: false });

  const url = new URL(req.url);
  const songId = url.searchParams.get("songId");
  const songSlug = url.searchParams.get("songSlug");

  let resolvedSongId = songId;

  if (!resolvedSongId && songSlug) {
    const song = await supabaseAdmin
      .from("songs")
      .select("id")
      .eq("slug", songSlug)
      .maybeSingle();

    resolvedSongId = song.data?.id || null;
  }

  if (!resolvedSongId) return NextResponse.json({ ok: true, saved: false });

  const row = await supabaseAdmin
    .from("user_favorite_songs")
    .select("id,status")
    .eq("user_id", user.id)
    .eq("song_id", resolvedSongId)
    .neq("status", "removed")
    .maybeSingle();

  return NextResponse.json({ ok: true, saved: Boolean(row.data?.id) });
}
