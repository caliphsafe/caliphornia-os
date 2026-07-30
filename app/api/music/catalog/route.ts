import { NextResponse } from "next/server";
import { requireCurrentAppUser } from "@/lib/users";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { resolveEffectiveAccess } from "@/lib/access/effective-access";

async function signedCover(path?: string | null) {
  if (!path) return null;
  try {
    const { data } = await supabaseAdmin.storage.from("cover-art").createSignedUrl(path, 60 * 60);
    return data?.signedUrl || null;
  } catch { return null; }
}

function first(value: any) { return Array.isArray(value) ? value[0] : value; }

export async function GET() {
  try {
    const user = await requireCurrentAppUser();
    const [songsRes, favRes, projectsRes] = await Promise.all([
      supabaseAdmin.from("songs").select("id,slug,title,artist_name,producer_names,duration_label,cover_image_path,source_app_slug,project_id,app_id,is_shareable,status").neq("status", "archived").order("title", { ascending: true }),
      supabaseAdmin.from("user_favorite_songs").select("id,song_id,song_slug,status,favorite_order,created_at").or(`user_id.eq.${user.id},user_email.eq.${user.email}`).neq("status", "removed"),
      supabaseAdmin.from("projects").select("id,slug,name,status"),
    ]);

    const favorites = favRes.data || [];
    const favoriteBySongId = new Map(favorites.map((row: any) => [row.song_id, row]));
    const favoriteBySlug = new Map(favorites.map((row: any) => [row.song_slug, row]));
    const projects = new Map((projectsRes.data || []).map((row: any) => [row.id, row]));

    const songs = await Promise.all((songsRes.data || []).map(async (song: any) => {
      const favorite = favoriteBySongId.get(song.id) || favoriteBySlug.get(song.slug) || null;
      const project = projects.get(song.project_id) || null;
      let accessLabel = "Preview";
      let shareable = Boolean(song.is_shareable !== false);
      try {
        const access = await resolveEffectiveAccess({ userId: user.id, userEmail: user.email, songId: song.id, songSlug: song.slug });
        accessLabel = access.displayLabel || access.accessType || accessLabel;
        shareable = shareable && Boolean(access.sharingEligible || access.allowed);
      } catch {
        accessLabel = favorite ? "Saved" : "Preview";
      }
      return {
        id: song.id,
        slug: song.slug,
        title: song.title || song.slug,
        artist: song.artist_name || "Caliph",
        projectName: project?.name || song.source_app_slug || "Caliphornia OS",
        projectSlug: project?.slug || song.source_app_slug || "",
        appSlug: song.source_app_slug || "",
        durationLabel: song.duration_label || "",
        coverUrl: await signedCover(song.cover_image_path),
        favorite: Boolean(favorite),
        favoriteId: favorite?.id || null,
        favoriteOrder: favorite?.favorite_order || null,
        accessLabel,
        shareable,
      };
    }));

    return NextResponse.json({ ok: true, songs });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "Could not load Music catalog." }, { status: 500 });
  }
}
