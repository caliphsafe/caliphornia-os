import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

async function audit(adminId: string, action: string, metadata: Record<string, unknown>) {
  try {
    await supabaseAdmin.from("admin_audit_logs").insert({
      admin_user_id: adminId,
      action_type: action,
      target_type: "song",
      target_id: metadata.songId ? String(metadata.songId) : null,
      reason: action,
      metadata,
    });
  } catch {}
}

function cleanSlug(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdminUser();
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "update_song");
    const title = String(body.title || "").trim();
    const slug = cleanSlug(String(body.slug || title));
    if (!title || !slug) return NextResponse.json({ ok: false, error: "Title and slug are required." }, { status: 400 });

    const app = body.appSlug ? await supabaseAdmin.from("apps").select("id,slug").eq("slug", String(body.appSlug)).maybeSingle() : { data: null } as any;

    const row = {
      title,
      slug,
      artist_name: String(body.artistName || "Caliph").trim() || "Caliph",
      audio_path: String(body.audioPath || "").trim() || null,
      preview_audio_path: String(body.previewPath || "").trim() || null,
      status: String(body.status || "active"),
      project_id: body.projectId ? String(body.projectId) : null,
      app_id: app.data?.id || null,
      source_app_slug: String(body.appSlug || "music"),
      is_shareable: Boolean(body.isShareable),
      is_locked: Boolean(body.isLocked),
      requires_project_access: Boolean(body.requiresProjectAccess),
      updated_at: new Date().toISOString(),
    };

    if (action === "create_song") {
      const inserted = await supabaseAdmin.from("songs").insert(row).select("id,slug,title").single();
      if (inserted.error) throw new Error(inserted.error.message);
      await audit(admin.id, "create_song", { songId: inserted.data.id, slug, title });
      return NextResponse.json({ ok: true, message: `Created ${inserted.data.title}.` });
    }

    const songId = String(body.songId || "");
    if (!songId) return NextResponse.json({ ok: false, error: "Song ID required." }, { status: 400 });
    const updated = await supabaseAdmin.from("songs").update(row).eq("id", songId).select("id,slug,title").single();
    if (updated.error) throw new Error(updated.error.message);
    await audit(admin.id, "update_song", { songId, slug, title });
    return NextResponse.json({ ok: true, message: `Updated ${updated.data.title}.` });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "Music admin action failed." }, { status: 500 });
  }
}
