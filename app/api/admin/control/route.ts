import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { normalizeEmail, randomToken, idempotencyKey } from "@/lib/crypto";
import { getOrCreateAppUser } from "@/lib/users";
import { createKiikuTransaction } from "@/lib/kiiku/ledger";

function bad(error: string, status = 400) {
  return NextResponse.json({ ok: false, error }, { status });
}

async function audit(adminId: string, action: string, metadata: Record<string, unknown>) {
  try {
    await supabaseAdmin.from("admin_audit_logs").insert({
      admin_user_id: adminId,
      action_type: action,
      target_type: String(metadata.targetType || "account"),
      target_id: metadata.targetId ? String(metadata.targetId) : null,
      reason: String(metadata.reason || action),
      metadata,
    });
  } catch {}
}

async function getTarget(targetUserId?: string | null) {
  if (!targetUserId) return null;
  const { data } = await supabaseAdmin.from("app_users").select("id,email,username,role,status").eq("id", targetUserId).maybeSingle();
  return data;
}

async function sendBlastIfConfigured(input: { subject: string; body: string; emails: string[] }) {
  const webhook = process.env.EMAIL_PROVIDER_WEBHOOK_URL;
  if (!webhook) return { sent: false, reason: "EMAIL_PROVIDER_WEBHOOK_URL is not set, blast was queued only." };
  const res = await fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "blast", subject: input.subject, body: input.body, recipients: input.emails }),
  }).catch(() => null);
  return { sent: Boolean(res?.ok), reason: res?.ok ? "Blast sent to provider." : "Provider rejected the blast, record was queued." };
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdminUser();
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");
    const target = await getTarget(body.targetUserId ? String(body.targetUserId) : null);

    if (action === "create_account") {
      const email = normalizeEmail(String(body.email || ""));
      if (!email.includes("@")) return bad("Enter a valid email.");
      const username = String(body.username || "").trim() || email.split("@")[0];
      const role = ["user", "admin", "owner"].includes(String(body.role)) ? String(body.role) : "user";
      const user = await getOrCreateAppUser(email, username);
      await supabaseAdmin.from("app_users").update({ role, status: "active", username }).eq("id", user.id);
      await audit(admin.id, "create_account", { targetId: user.id, email, role });
      return NextResponse.json({ ok: true, message: `Created or updated ${email}.` });
    }

    if (!target?.id && !["create_invite", "create_blast"].includes(action)) return bad("Select an account first.");

    if (action === "set_role") {
      const role = ["user", "admin", "owner"].includes(String(body.role)) ? String(body.role) : "user";
      await supabaseAdmin.from("app_users").update({ role }).eq("id", target.id);
      await audit(admin.id, "set_role", { targetId: target.id, email: target.email, role });
      return NextResponse.json({ ok: true, message: `Role updated to ${role}.` });
    }

    if (action === "set_status") {
      const status = ["active", "disabled", "blocked"].includes(String(body.status)) ? String(body.status) : "active";
      await supabaseAdmin.from("app_users").update({ status }).eq("id", target.id);
      await audit(admin.id, "set_status", { targetId: target.id, email: target.email, status });
      return NextResponse.json({ ok: true, message: `Status updated to ${status}.` });
    }

    if (action === "grant_pass") {
      const accessKey = String(body.accessKey || "all_access");
      await supabaseAdmin.from("user_access_passes").upsert({
        user_id: target.id,
        user_email: target.email,
        access_key: accessKey,
        source_type: "admin_grant",
        status: "active",
        idempotency_key: idempotencyKey(["admin_pass", target.id, accessKey]),
      }, { onConflict: "idempotency_key" });
      await audit(admin.id, "grant_pass", { targetId: target.id, email: target.email, accessKey });
      return NextResponse.json({ ok: true, message: `Granted ${accessKey}.` });
    }

    if (action === "grant_project") {
      const projectId = String(body.projectId || "");
      const project = await supabaseAdmin.from("projects").select("id,slug,name,title").eq("id", projectId).maybeSingle();
      if (!project.data?.id) return bad("Project not found.", 404);
      await supabaseAdmin.from("user_project_access").upsert({
        user_id: target.id,
        user_email: target.email,
        project_id: project.data.id,
        project_slug: project.data.slug,
        access_type: "admin_grant",
        status: "active",
        idempotency_key: idempotencyKey(["admin_project", target.id, project.data.id]),
      }, { onConflict: "idempotency_key" });
      await audit(admin.id, "grant_project", { targetId: target.id, email: target.email, projectId });
      return NextResponse.json({ ok: true, message: `Granted project ${project.data.name || project.data.slug}.` });
    }

    if (action === "grant_song") {
      const songId = String(body.songId || "");
      const song = await supabaseAdmin.from("songs").select("id,slug,title,project_id,app_id").eq("id", songId).maybeSingle();
      if (!song.data?.id) return bad("Song not found.", 404);
      await supabaseAdmin.from("user_song_access").upsert({
        user_id: target.id,
        user_email: target.email,
        song_id: song.data.id,
        song_slug: song.data.slug,
        project_id: song.data.project_id,
        app_id: song.data.app_id,
        access_type: "admin_grant",
        status: "active",
        idempotency_key: idempotencyKey(["admin_song", target.id, song.data.id]),
      }, { onConflict: "idempotency_key" });
      await audit(admin.id, "grant_song", { targetId: target.id, email: target.email, songId });
      return NextResponse.json({ ok: true, message: `Granted song ${song.data.title || song.data.slug}.` });
    }

    if (action === "grant_app") {
      const appId = String(body.appId || "");
      const app = await supabaseAdmin.from("apps").select("id,slug,name,title").eq("id", appId).maybeSingle();
      if (!app.data?.id) return bad("App not found.", 404);
      await supabaseAdmin.from("user_access_passes").upsert({
        user_id: target.id,
        user_email: target.email,
        access_key: `app:${app.data.slug}`,
        app_id: app.data.id,
        source_type: "admin_grant",
        status: "active",
        idempotency_key: idempotencyKey(["admin_app", target.id, app.data.id]),
      }, { onConflict: "idempotency_key" });
      await audit(admin.id, "grant_app", { targetId: target.id, email: target.email, appId });
      return NextResponse.json({ ok: true, message: `Granted app ${app.data.name || app.data.slug}.` });
    }

    if (action === "add_kiiku") {
      const amount = Math.max(1, Math.floor(Number(body.amount || 0)));
      const reason = String(body.reason || "Admin adjustment").slice(0, 180);
      await createKiikuTransaction({
        userId: target.id,
        amount,
        direction: "adjustment",
        transactionType: "admin_adjustment",
        reason,
        idempotencyKey: idempotencyKey(["admin_kiiku", target.id, admin.id, Date.now()]),
        metadata: { admin_email: admin.email },
      });
      await audit(admin.id, "add_kiiku", { targetId: target.id, email: target.email, amount, reason });
      return NextResponse.json({ ok: true, message: `Added ${amount} Kiiku.` });
    }

    if (action === "create_invite") {
      const token = randomToken(24);
      const email = normalizeEmail(String(body.email || ""));
      const role = ["user", "admin"].includes(String(body.role)) ? String(body.role) : "user";
      const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString();
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || req.headers.get("origin") || "";
      await supabaseAdmin.from("admin_invite_links").insert({
        token,
        email: email || null,
        role,
        status: "active",
        created_by_user_id: admin.id,
        expires_at: expiresAt,
        metadata: { created_by_email: admin.email },
      });
      await audit(admin.id, "create_invite", { email, role, expiresAt });
      return NextResponse.json({ ok: true, message: `${siteUrl.replace(/\/$/, "")}/invite/${token}` });
    }

    if (action === "create_blast") {
      const subject = String(body.subject || "").trim();
      const blastBody = String(body.body || "").trim();
      if (!subject || !blastBody) return bad("Subject and message are required.");
      const users = await supabaseAdmin.from("app_users").select("email,status").eq("status", "active");
      const emails = (users.data || []).map((row: any) => row.email).filter(Boolean);
      const provider = await sendBlastIfConfigured({ subject, body: blastBody, emails });
      await supabaseAdmin.from("admin_email_blasts").insert({
        subject,
        body: blastBody,
        recipient_count: emails.length,
        status: provider.sent ? "sent" : "queued",
        created_by_user_id: admin.id,
        metadata: { provider_reason: provider.reason },
      });
      await audit(admin.id, "create_blast", { subject, recipient_count: emails.length, sent: provider.sent });
      return NextResponse.json({ ok: true, message: `${provider.reason} Recipients: ${emails.length}.` });
    }

    return bad("Unknown admin action.");
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "Admin action failed." }, { status: 500 });
  }
}
