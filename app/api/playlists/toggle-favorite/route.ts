import { NextRequest, NextResponse } from "next/server";
import { requireCurrentAppUser } from "@/lib/users";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(req: NextRequest) {
  try {
    const user = await requireCurrentAppUser();
    const body = await req.json();
    const songId = String(body.songId || "");
    const songSlug = String(body.songSlug || "");
    if (!songId && !songSlug) return NextResponse.json({ ok:false, error:"Song required." }, { status:400 });
    const song = songId ? await supabaseAdmin.from("songs").select("id,slug").eq("id", songId).maybeSingle() : await supabaseAdmin.from("songs").select("id,slug").eq("slug", songSlug).maybeSingle();
    if (!song.data?.id) return NextResponse.json({ ok:false, error:"Song not found." }, { status:404 });
    const existing = await supabaseAdmin.from("user_favorite_songs").select("id,status").eq("user_id", user.id).eq("song_id", song.data.id).maybeSingle();
    if (existing.data?.id && existing.data.status !== "removed") {
      await supabaseAdmin.from("user_favorite_songs").update({ status:"removed", removed_at: new Date().toISOString() }).eq("id", existing.data.id);
      return NextResponse.json({ ok:true, saved:false });
    }
    await supabaseAdmin.from("user_favorite_songs").upsert({ user_id: user.id, user_email: user.email, song_id: song.data.id, song_slug: song.data.slug, status:"active", source_type:"manual" }, { onConflict:"user_id,song_id" });
    return NextResponse.json({ ok:true, saved:true });
  } catch {
    return NextResponse.json({ ok:false, error:"Could not update library." }, { status:500 });
  }
}
