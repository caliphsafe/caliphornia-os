import { NextRequest, NextResponse } from "next/server";
import { adminError, requireAdminUser } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sha256 } from "@/lib/crypto";

function createInviteCode() {
  const first = crypto.randomUUID().replaceAll("-", "").slice(0, 8);
  const second = crypto.randomUUID().replaceAll("-", "").slice(0, 8);
  return `${first}-${second}`.toUpperCase();
}

export async function GET() {
  try {
    await requireAdminUser();

    const result = await supabaseAdmin
      .from("admin_invite_links")
      .select(
        "id, name, invite_code, role, max_uses, uses, status, expires_at, metadata, created_at, updated_at",
      )
      .order("created_at", { ascending: false })
      .limit(200);

    if (result.error) {
      throw new Error(result.error.message);
    }

    return NextResponse.json({ ok: true, invites: result.data || [] });
  } catch (error) {
    return adminError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdminUser();
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "createInvite");

    if (action === "createInvite") {
      const inviteCode = createInviteCode();
      const maxUses = Math.max(1, Math.floor(Number(body.maxUses || 1)));
      const role = ["user", "admin"].includes(String(body.role))
        ? String(body.role)
        : "user";

      const metadata: Record<string, unknown> =
        body.metadata &&
        typeof body.metadata === "object" &&
        !Array.isArray(body.metadata)
          ? { ...body.metadata }
          : {};

      const restrictedEmail = String(body.email || "").trim().toLowerCase();
      if (restrictedEmail) {
        metadata.email = restrictedEmail;
      }

      const row = {
        name: String(body.name || "").trim() || "Caliphornia OS Invite",
        invite_code: inviteCode,
        token_hash: sha256(inviteCode),
        role,
        max_uses: maxUses,
        uses: 0,
        status: "active",
        created_by_user_id: admin.id,
        expires_at: body.expiresAt || null,
        metadata,
      };

      const result = await supabaseAdmin
        .from("admin_invite_links")
        .insert(row)
        .select(
          "id, name, invite_code, role, max_uses, uses, status, expires_at, metadata, created_at, updated_at",
        )
        .single();

      if (result.error) {
        throw new Error(result.error.message);
      }

      await supabaseAdmin
        .from("admin_audit_logs")
        .insert({
          admin_user_id: admin.id,
          action_type: "invite.create",
          target_type: "admin_invite_links",
          target_id: result.data.id,
          metadata: { role, max_uses: maxUses },
        })
        .then(
          () => null,
          () => null,
        );

      return NextResponse.json({
        ok: true,
        invite: result.data,
        inviteUrl: `/invite/${inviteCode}`,
      });
    }

    if (action === "revokeInvite") {
      const inviteId = String(body.inviteId || "");

      if (!inviteId) {
        return NextResponse.json(
          { ok: false, error: "Invite ID is required." },
          { status: 400 },
        );
      }

      const result = await supabaseAdmin
        .from("admin_invite_links")
        .update({
          status: "revoked",
          updated_at: new Date().toISOString(),
        })
        .eq("id", inviteId)
        .select("id")
        .maybeSingle();

      if (result.error) {
        throw new Error(result.error.message);
      }

      if (!result.data?.id) {
        return NextResponse.json(
          { ok: false, error: "Invite not found." },
          { status: 404 },
        );
      }

      await supabaseAdmin
        .from("admin_audit_logs")
        .insert({
          admin_user_id: admin.id,
          action_type: "invite.revoke",
          target_type: "admin_invite_links",
          target_id: inviteId,
          metadata: {},
        })
        .then(
          () => null,
          () => null,
        );

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json(
      { ok: false, error: "Unknown invite action." },
      { status: 400 },
    );
  } catch (error) {
    return adminError(error);
  }
}
