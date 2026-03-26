import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const bucket = String(body.bucket || "").trim();
    const path = String(body.path || "").trim();
    const upsert = Boolean(body.upsert);

    if (!bucket || !path) {
      return NextResponse.json(
        { ok: false, error: "Missing bucket or path." },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin.storage
      .from(bucket)
      .createSignedUploadUrl(path, { upsert });

    if (error || !data?.token) {
      return NextResponse.json(
        { ok: false, error: error?.message || "Could not create signed upload URL." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      bucket,
      path,
      token: data.token
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Server error." },
      { status: 500 }
    );
  }
}
