import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { auditAction } from "@/lib/audit";
const allowedBuckets = new Set(["songs", "cover-art", "visuals", "admin-uploads"]);
export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdminUser();
    const body = await req.json();
    const bucket = String(body.bucket || "");
    const path = String(body.path || "").replace(/^\/+/, "");
    if (!allowedBuckets.has(bucket)) return NextResponse.json({ ok:false, error:"Bucket not allowed." }, { status:400 });
    if (!path || path.includes("..") || !/^[a-zA-Z0-9_./-]+$/.test(path)) return NextResponse.json({ ok:false, error:"Path not allowed." }, { status:400 });
    const signed = await supabaseAdmin.storage.from(bucket).createSignedUploadUrl(path, { upsert: Boolean(body.upsert) });
    if (signed.error) throw new Error(signed.error.message);
    await auditAction({ adminUserId:admin.id, actionType:"signed_upload_url_created", targetTable:"storage", targetId:`${bucket}/${path}`, reason:"admin_upload", metadata:{ bucket, path } });
    return NextResponse.json({ ok:true, ...signed.data });
  } catch { return NextResponse.json({ ok:false, error:"Could not create upload URL." }, { status:500 }); }
}
