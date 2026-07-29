import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { auditAction } from "@/lib/audit";
const tables = new Set(["kiiku_rules","kiiku_campaigns","project_release_goals","sharing_rules","commerce_products"]);
export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdminUser();
    const body = await req.json();
    const table = String(body.table || "");
    if (!tables.has(table)) return NextResponse.json({ ok:false, error:"Unsupported admin table." }, { status:400 });
    if (!body.reason) return NextResponse.json({ ok:false, error:"Reason is required." }, { status:400 });
    const row = { ...(body.record || {}), updated_at: new Date().toISOString() };
    const result = row.id ? await supabaseAdmin.from(table).update(row).eq("id", row.id).select("*").single() : await supabaseAdmin.from(table).insert(row).select("*").single();
    if (result.error) throw new Error(result.error.message);
    await auditAction({ adminUserId:admin.id, actionType:"admin_rule_upsert", targetTable:table, targetId:result.data.id, reason:body.reason, afterSnapshot:result.data });
    return NextResponse.json({ ok:true, record:result.data });
  } catch { return NextResponse.json({ ok:false, error:"Admin action failed." }, { status:500 }); }
}
