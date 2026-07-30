import { NextRequest, NextResponse } from "next/server";
import { requireCurrentAppUser } from "@/lib/users";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(req: NextRequest) {
  try {
    const user = await requireCurrentAppUser();
    const body = await req.json();
    const order = Array.isArray(body.order) ? body.order : [];
    for (const row of order) {
      const favoriteOrder = Number(row.order || 0);
      if (!favoriteOrder) continue;
      let query = supabaseAdmin.from("user_favorite_songs").update({ favorite_order: favoriteOrder }).eq("user_id", user.id);
      if (row.favoriteId) query = query.eq("id", row.favoriteId);
      else if (row.songId) query = query.eq("song_id", row.songId);
      else continue;
      await query;
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "Could not reorder favorites." }, { status: 500 });
  }
}
