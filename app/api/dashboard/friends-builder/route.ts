import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { auditAction } from "@/lib/audit";
export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdminUser();
    const body = await req.json();
    const slug = String(body.slug || "").trim().toLowerCase();
    const title = String(body.title || slug || "").trim();
    if (!slug || !title) return NextResponse.json({ ok:false, error:"Slug and title required." }, { status:400 });
    const convo = await supabaseAdmin.from("conversations").upsert({ slug, title, status:"active", app_slug:"friends" }, { onConflict:"slug" }).select("*").single();
    if (convo.error) throw new Error(convo.error.message);
    if (Array.isArray(body.messages)) {
      for (let i=0;i<body.messages.length;i++) await supabaseAdmin.from("conversation_messages").insert({ conversation_id:convo.data.id, body:String(body.messages[i].body || body.messages[i] || ""), position:i });
    }
    await auditAction({ adminUserId:admin.id, actionType:"friends_conversation_upserted", targetTable:"conversations", targetId:convo.data.id, reason:body.reason || "admin_builder", afterSnapshot:convo.data });
    return NextResponse.json({ ok:true, conversation:convo.data });
  } catch { return NextResponse.json({ ok:false, error:"Could not save fri.ends conversation." }, { status:500 }); }
}
