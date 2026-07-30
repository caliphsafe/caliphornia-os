import { NextRequest, NextResponse } from "next/server";
import { adminError, requireAdminUser } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

async function sendWebhook(subject: string, body: string, recipients: string[]) {
  const url = process.env.EMAIL_PROVIDER_WEBHOOK_URL;
  if (!url) return { sent: false, provider: "none" };
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "blast", subject, body, recipients, from: process.env.EMAIL_FROM || "Caliphornia OS" }),
  });
  return { sent: true, provider: "webhook" };
}

export async function GET() {
  try {
    await requireAdminUser();
    const blasts = await supabaseAdmin.from("admin_email_blasts").select("*").order("created_at", { ascending: false }).limit(100).then((r) => r, () => ({ data: [] }));
    return NextResponse.json({ ok: true, blasts: blasts.data || [] });
  } catch (error) { return adminError(error); }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdminUser();
    const body = await req.json();
    const action = String(body.action || "draftBlast");
    const subject = String(body.subject || "").trim();
    const message = String(body.body || "").trim();
    if (!subject || !message) return NextResponse.json({ ok: false, error: "Subject and message are required." }, { status: 400 });

    const users = await supabaseAdmin.from("app_users").select("email,status").neq("status", "blocked").limit(5000);
    const recipients = (users.data || []).map((u) => String(u.email || "")).filter(Boolean);
    const shouldSend = action === "sendBlast";
    const delivery = shouldSend ? await sendWebhook(subject, message, recipients) : { sent: false, provider: "draft" };
    const status = shouldSend ? (delivery.sent ? "sent" : "queued_without_provider") : "draft";

    const saved = await supabaseAdmin.from("admin_email_blasts").insert({ subject, body: message, status, recipient_count: recipients.length, created_by_user_id: admin.id, metadata: { delivery } }).select("*").single();
    if (saved.error) throw new Error(saved.error.message);
    await supabaseAdmin.from("admin_audit_logs").insert({ admin_user_id: admin.id, action: shouldSend ? "blast.send" : "blast.draft", metadata: { subject, recipient_count: recipients.length, status } }).then(() => null, () => null);
    return NextResponse.json({ ok: true, blast: saved.data });
  } catch (error) { return adminError(error); }
}
