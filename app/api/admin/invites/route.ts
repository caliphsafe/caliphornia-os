import { NextRequest, NextResponse } from "next/server";
import { adminError, requireAdminUser } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sha256 } from "@/lib/crypto";

function code() {
  return Math.random().toString(36).slice(2, 8).toUpperCase() + "-" + Math.random().toString(36).slice(2, 8).toUpperCase();
}

export async function GET() {
  try {
    await requireAdminUser();
    const invites = await supabaseAdmin.from("admin_invite_links").select("*").order("created_at", { ascending: false }).limit(200).then((r) => r, () => ({ data: [] }));
    return NextResponse.json({ ok: true, invites: invites.data || [] });
  } catch (error) { return adminError(error); }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdminUser();
    const body = await req.json();
    const action = String(body.action || "createInvite");

    if (action === "createInvite") {
      const inviteCode = code();
      const row = {
        name: body.name || "Caliphornia OS Invite",
        invite_code: inviteCode,
        token_hash: sha256(inviteCode),
        role: ["user", "admin"].includes(String(body.role)) ? String(body.role) : "user",
        max_uses: Math.max(1, Number(body.maxUses || 1)),
        uses: 0,
        status: "active",
        created_by_user_id: admin.id,
        metadata: body.metadata || {},
      };
      const result = await supabaseAdmin.from("admin_invite_links").insert(row).select("*").single();
      if (result.error) throw new Error(result.error.message);
      await supabaseAdmin.from("admin_audit_logs").insert({ admin_user_id: admin.id, action: "invite.create", metadata: { invite_code: inviteCode } }).then(() => null, () => null);
      return NextResponse.json({ ok: true, invite: result.data, inviteUrl: `/invite/${inviteCode}` });
    }

    if (action === "revokeInvite") {
      await supabaseAdmin.from("admin_invite_links").update({ status: "revoked" }).eq("id", String(body.inviteId));
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: false, error: "Unknown invite action." }, { status: 400 });
  } catch (error) { return adminError(error); }
}
