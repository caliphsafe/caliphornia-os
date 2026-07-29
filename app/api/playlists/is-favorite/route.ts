import { NextRequest, NextResponse } from "next/server";
import { getCurrentAppUser } from "@/lib/users";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(req: NextRequest) {
  const user = await getCurrentAppUser();
  if (!user) return NextResponse.json({ ok:true, saved:false });
  const songId = new URL(req.url).searchParams.get("songId");
  if (!songId) return NextResponse.json({ ok:true, saved:false });
  const row = await supabaseAdmin.from("user_favorite_songs").select("id,status").eq("user_id", user.id).eq("song_id", songId).neq("status", "removed").maybeSingle();
  return NextResponse.json({ ok:true, saved: Boolean(row.data?.id) });
}
