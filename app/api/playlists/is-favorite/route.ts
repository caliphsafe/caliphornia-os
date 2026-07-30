import { NextRequest, NextResponse } from "next/server";
import { getCurrentAppUser } from "@/lib/users";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(req: NextRequest) {
  const user = await getCurrentAppUser();
  if (!user) return NextResponse.json({ ok: true, saved: false });
  const url = new URL(req.url);
  const songId = url.searchParams.get("songId");
  const songSlug = url.searchParams.get("songSlug");
  if (!songId && !songSlug) return NextResponse.json({ ok: true, saved: false });

  let query = supabaseAdmin
    .from("user_favorite_songs")
    .select("id,status")
    .eq("user_id", user.id)
    .neq("status", "removed")
    .limit(1);

  query = songId ? query.eq("song_id", songId) : query.eq("song_slug", songSlug);
  const row = await query.maybeSingle();
  return NextResponse.json({ ok: true, saved: Boolean(row.data?.id) });
}
