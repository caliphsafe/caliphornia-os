import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentAppUser } from "@/lib/users";
import { resolveEffectiveAccess } from "@/lib/access/effective-access";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getCurrentAppUser();
  const song = await supabaseAdmin.from("songs").select("id,slug,title,artist,cover_path,project_id,app_id").eq("slug", slug).maybeSingle();
  if (!song.data) return NextResponse.json({ ok:false, error:"Song not found." }, { status:404 });
  const access = await resolveEffectiveAccess({ userId:user?.id, userEmail:user?.email, songId:song.data.id });
  return NextResponse.json({ ok:true, song:song.data, access });
}
