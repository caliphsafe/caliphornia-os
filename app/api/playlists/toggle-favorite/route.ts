import { NextRequest, NextResponse } from "next/server";
import { requireCurrentAppUser } from "@/lib/users";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(req: NextRequest) {
  try {
    const user = await requireCurrentAppUser();
    const body = await req.json().catch(() => ({}));
    const songId = String(body.songId || "");
    const songSlug = String(body.songSlug || "");
    if (!songId && !songSlug) return NextResponse.json({ ok: false, error: "Song required." }, { status: 400 });

    const song = songId
      ? await supabaseAdmin.from("songs").select("id,slug").eq("id", songId).maybeSingle()
      : await supabaseAdmin.from("songs").select("id,slug").eq("slug", songSlug).maybeSingle();

    if (!song.data?.id) return NextResponse.json({ ok: false, error: "Song not found." }, { status: 404 });

    const existing = await supabaseAdmin
      .from("user_favorite_songs")
      .select("id,status")
      .eq("user_id", user.id)
      .eq("song_id", song.data.id)
      .maybeSingle();

    if (existing.data?.id && existing.data.status !== "removed") {
      await supabaseAdmin
        .from("user_favorite_songs")
        .update({ status: "removed", removed_at: new Date().toISOString() })
        .eq("id", existing.data.id);
      return NextResponse.json({ ok: true, saved: false });
    }

    if (existing.data?.id) {
      await supabaseAdmin
        .from("user_favorite_songs")
        .update({ status: "active", removed_at: null, song_slug: song.data.slug, source_type: "manual" })
        .eq("id", existing.data.id);
    } else {
      const maxOrder = await supabaseAdmin
        .from("user_favorite_songs")
        .select("favorite_order")
        .eq("user_id", user.id)
        .order("favorite_order", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();

      await supabaseAdmin.from("user_favorite_songs").insert({
        user_id: user.id,
        user_email: user.email,
        song_id: song.data.id,
        song_slug: song.data.slug,
        status: "active",
        source_type: "manual",
        favorite_order: Number(maxOrder.data?.favorite_order || 0) + 1,
      });
    }

    return NextResponse.json({ ok: true, saved: true });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "Could not update library." }, { status: 500 });
  }
}
