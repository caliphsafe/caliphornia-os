import { NextRequest, NextResponse } from "next/server";
import { getOrCreateAppUser } from "@/lib/users";
import { setSessionCookie } from "@/lib/session";
import { normalizeEmail, sha256 } from "@/lib/crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const code = String(body.code || "").trim().toUpperCase();
    const email = normalizeEmail(String(body.email || ""));
    const requestedUsername = String(body.username || "").trim();

    if (!code || !email.includes("@")) {
      return NextResponse.json(
        { ok: false, error: "Invite code and a valid email are required." },
        { status: 400 },
      );
    }

    const inviteResult = await supabaseAdmin
      .from("admin_invite_links")
      .select(
        "id, invite_code, token_hash, role, max_uses, uses, status, expires_at, metadata",
      )
      .eq("token_hash", sha256(code))
      .eq("status", "active")
      .maybeSingle();

    if (inviteResult.error) {
      throw new Error(inviteResult.error.message);
    }

    const invite = inviteResult.data;

    if (!invite?.id) {
      return NextResponse.json(
        { ok: false, error: "Invite not found, revoked, or unavailable." },
        { status: 404 },
      );
    }

    if (
      invite.expires_at &&
      new Date(invite.expires_at).getTime() <= Date.now()
    ) {
      return NextResponse.json(
        { ok: false, error: "This invite has expired." },
        { status: 410 },
      );
    }

    const uses = Number(invite.uses || 0);
    const maxUses = Number(invite.max_uses || 1);

    if (uses >= maxUses) {
      return NextResponse.json(
        { ok: false, error: "This invite has already reached its use limit." },
        { status: 409 },
      );
    }

    const restrictedEmail =
      invite.metadata &&
      typeof invite.metadata === "object" &&
      !Array.isArray(invite.metadata) &&
      typeof invite.metadata.email === "string"
        ? normalizeEmail(invite.metadata.email)
        : "";

    if (restrictedEmail && restrictedEmail !== email) {
      return NextResponse.json(
        { ok: false, error: "This invite was created for another email." },
        { status: 403 },
      );
    }

    const user = await getOrCreateAppUser(
      email,
      requestedUsername || undefined,
    );

    const role = ["owner", "admin", "user"].includes(String(invite.role))
      ? String(invite.role)
      : "user";

    const userUpdate: Record<string, string> = {
      role,
      status: "active",
    };

    if (requestedUsername) {
      userUpdate.username = requestedUsername;
    }

    const updateUserResult = await supabaseAdmin
      .from("app_users")
      .update(userUpdate)
      .eq("id", user.id);

    if (updateUserResult.error) {
      throw new Error(updateUserResult.error.message);
    }

    /*
     * Claim the invite atomically. The WHERE clauses prevent two requests from
     * consuming the same final use at the same time.
     */
    const claimResult = await supabaseAdmin
      .from("admin_invite_links")
      .update({
        uses: uses + 1,
        status: uses + 1 >= maxUses ? "used" : "active",
        updated_at: new Date().toISOString(),
      })
      .eq("id", invite.id)
      .eq("status", "active")
      .eq("uses", uses)
      .select("id")
      .maybeSingle();

    if (claimResult.error) {
      throw new Error(claimResult.error.message);
    }

    if (!claimResult.data?.id) {
      return NextResponse.json(
        {
          ok: false,
          error: "This invite was claimed by another request. Please try again.",
        },
        { status: 409 },
      );
    }

    await supabaseAdmin
      .from("admin_audit_logs")
      .insert({
        admin_user_id: null,
        action_type: "invite.claim",
        target_type: "admin_invite_links",
        target_id: invite.id,
        metadata: { email, user_id: user.id },
      })
      .then(
        () => null,
        () => null,
      );

    await setSessionCookie({
      email: user.email,
      username: requestedUsername || user.username || null,
      role,
      iat: Date.now(),
    });

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Invite could not be claimed.",
      },
      { status: 500 },
    );
  }
}
