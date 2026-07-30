import { NextRequest, NextResponse } from "next/server";
import { getOrCreateAppUser } from "@/lib/users";
import { setSessionCookie } from "@/lib/session";
import { sha256, normalizeEmail } from "@/lib/crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const code = String(body.code || "").trim().toUpperCase();
    const email = normalizeEmail(body.email || "");
    if (!code || !email) return NextResponse.json({ ok: false, error: "Invite code and email are required." }, { status: 400 });
    const invite = await supabaseAdmin.from("admin_invite_links").select("*").eq("token_hash", sha256(code)).eq("status", "active").maybeSingle();
    if (!invite.data?.id) return NextResponse.json({ ok: false, error: "Invite not found or expired." }, { status: 404 });
    if (Number(invite.data.uses || 0) >= Number(invite.data.max_uses || 1)) return NextResponse.json({ ok: false, error: "Invite has already been used." }, { status: 403 });
    if (invite.data.expires_at && new Date(invite.data.expires_at).getTime() <= Date.now()) return NextResponse.json({ ok: false, error: "Invite expired." }, { status: 403 });
    const user = await getOrCreateAppUser(email, body.username || null);
    if (invite.data.role && invite.data.role !== "user") await supabaseAdmin.from("app_users").update({ role: invite.data.role }).eq("id", user.id);
    await supabaseAdmin.from("admin_invite_links").update({ uses: Number(invite.data.uses || 0) + 1 }).eq("id", invite.data.id);
    await supabaseAdmin.from("admin_audit_logs").insert({ action: "invite.claim", metadata: { invite_id: invite.data.id, email } }).then(() => null, () => null);
    await setSessionCookie({ email: user.email, username: user.username || null, role: invite.data.role || user.role || "user", iat: Date.now() });
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "Invite could not be claimed." }, { status: 500 });
  }
}
