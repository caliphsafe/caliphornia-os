import { NextRequest, NextResponse } from "next/server";
import { sha256 } from "@/lib/crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";
export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get("guestToken") || "";
  const guest = await supabaseAdmin.from("guest_sessions").select("id,status,expires_at").eq("guest_token_hash", sha256(token)).maybeSingle();
  if (!guest.data?.id) return NextResponse.json({ ok:false, error:"Receive session expired." }, { status:401 });
  const rows = await supabaseAdmin.from("nearby_share_sessions").select("id,song_id,song_title_snapshot,sender_user_id,metadata,expires_at,status").eq("status", "searching").gt("expires_at", new Date().toISOString()).order("created_at", { ascending:false }).limit(8);
  const candidates = (rows.data || []).map((r:any)=>({ id:r.id, song_title:r.song_title_snapshot, sender_label:r.metadata?.sender_label || "Nearby listener" }));
  return NextResponse.json({ ok:true, candidates });
}
