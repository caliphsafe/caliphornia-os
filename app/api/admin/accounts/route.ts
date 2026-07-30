import { NextRequest, NextResponse } from "next/server";
import { adminError, requireAdminUser } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getOrCreateAppUser } from "@/lib/users";
import { createKiikuTransaction } from "@/lib/kiiku/ledger";
import { idempotencyKey, normalizeEmail } from "@/lib/crypto";

async function audit(adminId: string, action: string, metadata: Record<string, unknown>) {
  await supabaseAdmin.from("admin_audit_logs").insert({ admin_user_id: adminId, action, metadata }).then(() => null, () => null);
}

async function safeCount(table: string) {
  try {
    const res = await supabaseAdmin.from(table).select("id", { count: "exact", head: true });
    return res.count || 0;
  } catch { return 0; }
}

export async function GET(req: NextRequest) {
  try {
    await requireAdminUser();
    const includeOverview = new URL(req.url).searchParams.get("includeOverview") === "1";
    const users = await supabaseAdmin.from("app_users").select("id,email,username,role,status,created_at").order("created_at", { ascending: false }).limit(200);
    const payload: any = { ok: true, users: users.data || [] };
    if (includeOverview) {
      payload.summary = {
        users: users.data?.length || 0,
        songs: await safeCount("songs"),
        projects: await safeCount("projects"),
        invites: await safeCount("admin_invite_links"),
        blasts: await safeCount("admin_email_blasts"),
      };
    }
    return NextResponse.json(payload);
  } catch (error) { return adminError(error); }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdminUser();
    const body = await req.json();
    const action = String(body.action || "");
    const email = normalizeEmail(body.email || "");

    if (action === "createAccount") {
      if (!email) return NextResponse.json({ ok: false, error: "Email is required." }, { status: 400 });
      const user = await getOrCreateAppUser(email, body.username || null);
      if (body.role && body.role !== "user") {
        await supabaseAdmin.from("app_users").update({ role: String(body.role), status: "active" }).eq("id", user.id);
      }
      await audit(admin.id, "account.create", { email, role: body.role || "user" });
      return NextResponse.json({ ok: true, user });
    }

    if (action === "setRole") {
      if (!email) return NextResponse.json({ ok: false, error: "Email is required." }, { status: 400 });
      const role = ["user", "admin", "owner"].includes(String(body.role)) ? String(body.role) : "user";
      await supabaseAdmin.from("app_users").update({ role }).eq("email", email);
      await audit(admin.id, "account.role", { email, role });
      return NextResponse.json({ ok: true });
    }

    if (action === "setStatus") {
      if (!email) return NextResponse.json({ ok: false, error: "Email is required." }, { status: 400 });
      const status = String(body.status || "active");
      await supabaseAdmin.from("app_users").update({ status }).eq("email", email);
      await audit(admin.id, "account.status", { email, status });
      return NextResponse.json({ ok: true });
    }

    if (action === "grantKiiku") {
      if (!email) return NextResponse.json({ ok: false, error: "Email is required." }, { status: 400 });
      const user = await getOrCreateAppUser(email, body.username || null);
      const amount = Math.max(0, Math.floor(Number(body.amount || 0)));
      if (!amount) return NextResponse.json({ ok: false, error: "Kiiku amount is required." }, { status: 400 });
      const tx = await createKiikuTransaction({
        userId: user.id,
        amount,
        direction: "adjustment",
        transactionType: "admin_grant",
        reason: String(body.reason || "Admin Kiiku grant"),
        idempotencyKey: idempotencyKey(["admin_kiiku", admin.id, user.id, amount, Date.now()]),
        metadata: { admin_email: admin.email },
      });
      await audit(admin.id, "kiiku.grant", { email, amount });
      return NextResponse.json({ ok: true, transaction: tx });
    }

    if (action === "grantProjectAccess") {
      if (!email || !body.projectId) return NextResponse.json({ ok: false, error: "Email and project are required." }, { status: 400 });
      const user = await getOrCreateAppUser(email, body.username || null);
      const project = await supabaseAdmin.from("projects").select("id,slug").eq("id", String(body.projectId)).maybeSingle();
      if (!project.data?.id) return NextResponse.json({ ok: false, error: "Project not found." }, { status: 404 });
      await supabaseAdmin.from("user_project_access").upsert({ user_id: user.id, user_email: user.email, project_id: project.data.id, project_slug: project.data.slug, access_type: "admin_grant", source_type: "admin", status: "active" }, { onConflict: "user_id,project_id" });
      await audit(admin.id, "access.project.grant", { email, project_id: project.data.id });
      return NextResponse.json({ ok: true });
    }

    if (action === "grantPass") {
      if (!email) return NextResponse.json({ ok: false, error: "Email is required." }, { status: 400 });
      const user = await getOrCreateAppUser(email, body.username || null);
      const accessKey = String(body.accessKey || "music_full");
      await supabaseAdmin.from("user_access_passes").upsert({ user_id: user.id, user_email: user.email, access_key: accessKey, source_type: "admin", status: "active", idempotency_key: idempotencyKey(["admin_pass", user.id, accessKey]) }, { onConflict: "idempotency_key" });
      await audit(admin.id, "access.pass.grant", { email, access_key: accessKey });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: false, error: "Unknown account action." }, { status: 400 });
  } catch (error) { return adminError(error); }
}
