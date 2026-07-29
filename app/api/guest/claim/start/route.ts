import { NextRequest, NextResponse } from "next/server";
import { sha256, normalizeEmail } from "@/lib/crypto";
import { randomToken } from "@/lib/crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { isProduction } from "@/lib/env";
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = normalizeEmail(String(body.email || ""));
    if (!email.includes("@")) return NextResponse.json({ ok:false, error:"Enter a valid email." }, { status:400 });
    const guest = await supabaseAdmin.from("guest_sessions").select("id,status").eq("guest_token_hash", sha256(String(body.guestToken || ""))).maybeSingle();
    if (!guest.data?.id) return NextResponse.json({ ok:false, error:"Guest session expired." }, { status:401 });
    const code = String(Math.floor(100000 + Math.random()*900000));
    const expires = new Date(Date.now()+10*60*1000).toISOString();
    await supabaseAdmin.from("guest_claim_codes").insert({ guest_session_id:guest.data.id, email, code_hash:sha256(code), status:"active", expires_at:expires });
    if (process.env.EMAIL_PROVIDER_WEBHOOK_URL) {
      await fetch(process.env.EMAIL_PROVIDER_WEBHOOK_URL, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ to:email, subject:"Your Caliphornia OS code", text:`Your Caliphornia OS code is ${code}. It expires in 10 minutes.` }) });
    } else if (isProduction()) {
      return NextResponse.json({ ok:false, error:"Email sending is not configured yet." }, { status:503 });
    }
    return NextResponse.json({ ok:true, devCode: isProduction() ? undefined : code });
  } catch { return NextResponse.json({ ok:false, error:"Could not send code." }, { status:500 }); }
}
