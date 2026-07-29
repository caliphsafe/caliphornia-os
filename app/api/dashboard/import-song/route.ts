import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { auditAction } from "@/lib/audit";
export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdminUser();
    const body = await req.json();
    const title = String(body.title || "").trim();
    const slug = String(body.slug || "").trim().toLowerCase();
    if (!title || !slug) return NextResponse.json({ ok:false, error:"Title and slug required." }, { status:400 });
    const project = body.projectSlug ? await supabaseAdmin.from("projects").select("id,slug").eq("slug", body.projectSlug).maybeSingle() : { data:null } as any;
    const song = await supabaseAdmin.from("songs").upsert({ title, slug, artist: body.artist || "Caliph", audio_path: body.audioPath || null, preview_audio_path: body.previewAudioPath || null, cover_path: body.coverPath || null, project_id: project.data?.id || body.projectId || null, source_app_slug: body.projectSlug || null, is_locked: Boolean(body.isLocked), is_shareable: body.isShareable !== false, status:"active" }, { onConflict:"slug" }).select("*").single();
    if (song.error) throw new Error(song.error.message);
    if (body.lyrics) await supabaseAdmin.from("lyrics").upsert({ song_id:song.data.id, song_slug:song.data.slug, body: body.lyrics, lyric_type:"lyrics", status:"active" }, { onConflict:"song_id,lyric_type,language_code" });
    await auditAction({ adminUserId:admin.id, actionType:"song_imported", targetTable:"songs", targetId:song.data.id, reason:body.reason || "admin_import", afterSnapshot:song.data });
    return NextResponse.json({ ok:true, song:song.data });
  } catch { return NextResponse.json({ ok:false, error:"Could not import song." }, { status:500 }); }
}
