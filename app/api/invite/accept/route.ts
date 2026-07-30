import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getOrCreateAppUser } from "@/lib/users";
import { normalizeEmail } from "@/lib/crypto";
import { setSessionCookie } from "@/lib/session";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const token = String(body.token || "");
    const email = normalizeEmail(String(body.email || ""));
    const username = String(body.username || "").trim() || email.split("@")[0];
    if (!token || !email.includes("@")) return NextResponse.json({ ok: false, error: "Invite token and valid email are required." }, { status: 400 });

    const invite = await supabaseAdmin.from("admin_invite_links").select("*").eq("token", token).eq("status", "active").maybeSingle();
    if (!invite.data?.id) return NextResponse.json({ ok: false, error: "Invite expired or unavailable." }, { status: 404 });
    if (invite.data.expires_at && new Date(invite.data.expires_at).getTime() <= Date.now()) return NextResponse.json({ ok: false, error: "Invite expired." }, { status: 410 });
    if (invite.data.email && normalizeEmail(invite.data.email) !== email) return NextResponse.json({ ok: false, error: "This invite is for another email." }, { status: 403 });

    const user = await getOrCreateAppUser(email, username);
    const role = ["admin", "owner", "user"].includes(String(invite.data.role)) ? String(invite.data.role) : "user";
    await supabaseAdmin.from("app_users").update({ role, status: "active", username }).eq("id", user.id);
    await supabaseAdmin.from("admin_invite_links").update({ status: "accepted", accepted_by_user_id: user.id, accepted_at: new Date().toISOString() }).eq("id", invite.data.id);
    await setSessionCookie({ email: user.email, username: username, role, iat: Date.now() });
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "Could not accept invite." }, { status: 500 });
  }
}
