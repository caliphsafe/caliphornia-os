import { NextResponse } from "next/server";
import { requireCurrentAppUser } from "@/lib/users";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { resolveEffectiveAccess } from "@/lib/access/effective-access";

export const dynamic = "force-dynamic";


async function signedCover(path?: string | null) {
  if (!path) return null;
  try {
    const clean = String(path).replace(/^\/+/g, "");
    const objectPath = clean.startsWith("cover-art/") ? clean.replace(/^cover-art\//, "") : clean;
    const { data, error } = await supabaseAdmin.storage.from("cover-art").createSignedUrl(objectPath, 60 * 60);
    if (error || !data?.signedUrl) return null;
    return data.signedUrl;
  } catch {
    return null;
  }
}

function titleForProject(row: any) {
  return row?.name || row?.title || row?.slug || "Caliphornia OS";
}

export async function GET() {
  try {
    const user = await requireCurrentAppUser();

    const [songsRes, favoritesRes, projectsRes] = await Promise.all([
      supabaseAdmin
        .from("songs")
        .select("id,slug,title,artist,artist_name,project_id,app_id,source_app_slug,cover_image_path,cover_path,duration_label,status,is_shareable")
        .neq("status", "archived")
        .order("position", { ascending: true }),
      supabaseAdmin
        .from("user_favorite_songs")
        .select("id,user_id,user_email,song_id,song_slug,status,favorite_order,created_at")
        .or(`user_id.eq.${user.id},user_email.eq.${user.email}`)
        .neq("status", "removed")
        .order("favorite_order", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true }),
      supabaseAdmin.from("projects").select("id,slug,name,title,status").neq("status", "archived"),
    ]);

    if (songsRes.error) throw new Error(songsRes.error.message);

    const favoriteRows = favoritesRes.data || [];
    const favoriteBySongId = new Map(favoriteRows.filter((row: any) => row.song_id).map((row: any) => [row.song_id, row]));
    const favoriteBySlug = new Map(favoriteRows.filter((row: any) => row.song_slug).map((row: any) => [row.song_slug, row]));
    const projectRows = projectsRes.data || [];
    const projectMapById = new Map(projectRows.map((project: any) => [project.id, project]));
    const projectMapBySlug = new Map(projectRows.map((project: any) => [project.slug, project]));

    const songs = await Promise.all((songsRes.data || []).map(async (song: any) => {
      const project = projectMapById.get(song.project_id) || projectMapBySlug.get(song.source_app_slug) || null;
      const favorite = favoriteBySongId.get(song.id) || favoriteBySlug.get(song.slug) || null;
      const access = await resolveEffectiveAccess({
        userId: user.id,
        userEmail: user.email,
        songId: song.id,
        songSlug: song.slug,
        requestedAction: "play",
      }).catch(() => null);

      return {
        id: song.id,
        slug: song.slug,
        title: song.title || song.slug || "Song",
        artist: song.artist_name || song.artist || "Caliph",
        projectName: titleForProject(project),
        projectSlug: project?.slug || song.source_app_slug || "music",
        appSlug: song.source_app_slug || project?.slug || "music",
        coverUrl: await signedCover(song.cover_image_path || song.cover_path),
        durationLabel: song.duration_label || "",
        accessLabel: access?.displayLabel || (access?.playbackMode === "preview" ? "Preview" : "Available"),
        canPlay: access ? access.playbackMode !== "blocked" : true,
        isPreview: access ? access.playbackMode === "preview" : false,
        isFavorite: Boolean(favorite?.id),
        favoriteId: favorite?.id || null,
        favoriteOrder: typeof favorite?.favorite_order === "number" ? favorite.favorite_order : null,
        shareable: song.is_shareable !== false && Boolean(access?.sharingEligible || access?.allowed || favorite?.id),
        sharesRemaining: Number(access?.sharesRemaining || 0),
      };
    }));

    const activeSongs = songs.filter((song) => song.id && song.slug);
    const favorites = activeSongs
      .filter((song) => song.isFavorite)
      .sort((a, b) => {
        const aOrder = a.favoriteOrder ?? 999999;
        const bOrder = b.favoriteOrder ?? 999999;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return a.title.localeCompare(b.title);
      });

    const projectCount = new Map<string, { slug: string; name: string; count: number }>();
    for (const song of activeSongs) {
      const slug = song.projectSlug || song.appSlug || "music";
      const current = projectCount.get(slug) || { slug, name: song.projectName || slug, count: 0 };
      current.count += 1;
      projectCount.set(slug, current);
    }

    return NextResponse.json({
      ok: true,
      songs: activeSongs,
      favorites,
      projects: Array.from(projectCount.values()).sort((a, b) => a.name.localeCompare(b.name)),
    });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "Could not load Music library.", songs: [], favorites: [], projects: [] }, { status: 500 });
  }
}
