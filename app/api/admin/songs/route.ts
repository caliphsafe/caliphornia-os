import { NextRequest, NextResponse } from "next/server";
import { adminError, requireAdminUser } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

function cleanSong(input: any) {
  const row: Record<string, any> = {};
  for (const key of ["title", "slug", "artist_name", "producer_names", "description", "audio_path", "preview_audio_path", "cover_image_path", "source_app_slug", "status"]) {
    if (input[key] !== undefined) row[key] = input[key] || null;
  }
  for (const key of ["project_id", "app_id"]) if (input[key] !== undefined) row[key] = input[key] || null;
  for (const key of ["is_locked", "is_shareable", "requires_project_access", "requires_all_access", "is_free_full_play"]) if (input[key] !== undefined) row[key] = Boolean(input[key]);
  if (input.preview_starts_at !== undefined) row.preview_starts_at = Number(input.preview_starts_at || 0);
  if (input.preview_duration !== undefined) row.preview_duration = Number(input.preview_duration || 30);
  return row;
}

async function audit(adminId: string, action: string, metadata: Record<string, unknown>) {
  await supabaseAdmin.from("admin_audit_logs").insert({ admin_user_id: adminId, action, metadata }).then(() => null, () => null);
}

export async function GET() {
  try {
    await requireAdminUser();
    const [songs, projects, apps, products] = await Promise.all([
      supabaseAdmin.from("songs").select("*").order("created_at", { ascending: false }).limit(250),
      supabaseAdmin.from("projects").select("id,slug,name,status").order("created_at", { ascending: false }).limit(100),
      supabaseAdmin.from("apps").select("id,slug,name,status").order("created_at", { ascending: false }).limit(100).then((r) => r, () => ({ data: [] })),
      supabaseAdmin.from("commerce_products").select("id,product_key,name,product_type,project_id,song_id,price_cents,currency,status").eq("status", "active").limit(200).then((r) => r, () => ({ data: [] })),
    ]);
    return NextResponse.json({ ok: true, songs: songs.data || [], projects: projects.data || [], apps: apps.data || [], products: products.data || [] });
  } catch (error) { return adminError(error); }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdminUser();
    const body = await req.json();
    const action = String(body.action || "");
    const song = cleanSong(body.song || body);

    if (action === "createSong") {
      if (!song.title || !song.slug) return NextResponse.json({ ok: false, error: "Title and slug are required." }, { status: 400 });
      const inserted = await supabaseAdmin.from("songs").insert(song).select("*").single();
      if (inserted.error) throw new Error(inserted.error.message);
      await audit(admin.id, "song.create", { song_id: inserted.data.id, slug: inserted.data.slug });
      return NextResponse.json({ ok: true, song: inserted.data });
    }

    if (action === "updateSong") {
      const id = body.song?.id || body.id;
      if (!id) return NextResponse.json({ ok: false, error: "Song ID is required." }, { status: 400 });
      const updated = await supabaseAdmin.from("songs").update(song).eq("id", id).select("*").single();
      if (updated.error) throw new Error(updated.error.message);
      await audit(admin.id, "song.update", { song_id: id, fields: Object.keys(song) });
      return NextResponse.json({ ok: true, song: updated.data });
    }

    if (action === "toggleShareable") {
      const id = body.songId || body.id;
      const updated = await supabaseAdmin.from("songs").update({ is_shareable: Boolean(body.isShareable) }).eq("id", id).select("*").single();
      if (updated.error) throw new Error(updated.error.message);
      await audit(admin.id, "song.shareable", { song_id: id, is_shareable: Boolean(body.isShareable) });
      return NextResponse.json({ ok: true, song: updated.data });
    }

    return NextResponse.json({ ok: false, error: "Unknown song action." }, { status: 400 });
  } catch (error) { return adminError(error); }
}
