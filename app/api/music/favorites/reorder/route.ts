import { NextRequest, NextResponse } from "next/server";
import { requireCurrentAppUser } from "@/lib/users";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(req: NextRequest) {
  try {
    const user = await requireCurrentAppUser();
    const body = await req.json().catch(() => ({}));
    const songIds = Array.isArray(body.songIds) ? body.songIds.map(String).filter(Boolean) : [];
    if (!songIds.length) return NextResponse.json({ ok: true });

    for (let index = 0; index < songIds.length; index += 1) {
      await supabaseAdmin
        .from("user_favorite_songs")
        .update({ favorite_order: index + 1 })
        .eq("user_id", user.id)
        .eq("song_id", songIds[index]);
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "Could not reorder favorites." }, { status: 500 });
  }
}
