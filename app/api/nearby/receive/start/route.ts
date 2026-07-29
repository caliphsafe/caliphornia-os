import { NextRequest, NextResponse } from "next/server";
import { createTokenPair } from "@/lib/sharing/tokens";
import { supabaseAdmin } from "@/lib/supabase-admin";
export async function POST(req: NextRequest) {
  const body = await req.json().catch(()=>({}));
  const { token, tokenHash } = createTokenPair();
  const expires = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  const row = await supabaseAdmin.from("guest_sessions").insert({ guest_token_hash:tokenHash, status:"active", expires_at:expires, privacy_level:"reduced", metadata:{ device_label: String(body.deviceLabel || "Nearby listener") } }).select("id").single();
  if (row.error) return NextResponse.json({ ok:false, error:"Could not start receive session." }, { status:500 });
  return NextResponse.json({ ok:true, guestSessionId:row.data.id, guestToken:token, expiresAt:expires });
}
