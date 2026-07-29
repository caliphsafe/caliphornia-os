import { NextResponse } from "next/server";
import { requireCurrentAppUser } from "@/lib/users";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { resolveEffectiveAccess } from "@/lib/access/effective-access";

export async function GET() {
  try {
    const user = await requireCurrentAppUser();
    const { data, error } = await supabaseAdmin
      .from("user_favorite_songs")
      .select("id,status,source_type,song_id,song_slug,songs(id,slug,title,artist)")
      .or(`user_id.eq.${user.id},user_email.eq.${user.email}`)
      .neq("status", "removed")
      .order("created_at", { ascending:false });
    if (error) throw new Error(error.message);
    const songs = await Promise.all((data || []).map(async (row: any) => {
      const song = Array.isArray(row.songs) ? row.songs[0] : row.songs;
      const access = await resolveEffectiveAccess({ userId: user.id, userEmail: user.email, songId: row.song_id || song?.id, songSlug: row.song_slug || song?.slug });
      return { id: row.id, song_id: row.song_id || song?.id, song_slug: row.song_slug || song?.slug, title: song?.title || row.song_slug || "Song", artist: song?.artist || "Caliph", label: access.displayLabel, status: row.status || "active" };
    }));
    return NextResponse.json({ ok:true, songs });
  } catch {
    return NextResponse.json({ ok:false, error:"Could not load Music library." }, { status:500 });
  }
}
