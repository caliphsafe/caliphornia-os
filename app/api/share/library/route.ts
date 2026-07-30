import { NextResponse } from "next/server";
import { requireCurrentAppUser } from "@/lib/users";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  countShareCredits,
  hasProjectAccess,
  hasSongAccess,
  loadUserShareAccess,
  normalize,
  titleForProject,
  type ShareProjectRow,
  type ShareSongRow,
} from "@/lib/share/share-access";

function formatMoney(cents?: number | null, currency = "usd") {
  if (typeof cents !== "number") return null;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(cents / 100);
  } catch {
    return `$${(cents / 100).toFixed(2)}`;
  }
}

export async function GET() {
  try {
    const user = await requireCurrentAppUser();
    const access = await loadUserShareAccess(user);

    const [projectsRes, productsRes] = await Promise.all([
      supabaseAdmin
        .from("projects")
        .select("id,slug,name,status")
        .neq("status", "archived")
        .order("created_at", { ascending: true }),
      supabaseAdmin
        .from("commerce_products")
        .select("id,product_key,product_type,project_id,song_id,name,price_cents,currency,status")
        .eq("status", "active"),
    ]);

    const projects = ((projectsRes.data || []) as ShareProjectRow[]).filter(
      (project) => project.id && project.slug
    );
    const products = productsRes.data || [];

    const results = await Promise.all(
      projects.map(async (project) => {
        const songsRes = await supabaseAdmin
          .from("songs")
          .select("id,slug,title,artist_name,project_id,app_id,source_app_slug,is_shareable,is_locked,is_free_full_play,requires_project_access,requires_all_access,release_at,status,position")
          .or(`project_id.eq.${project.id},source_app_slug.eq.${project.slug}`)
          .neq("status", "archived")
          .order("position", { ascending: true });

        const songs = ((songsRes.data || []) as ShareSongRow[]).filter(
          (song) => song.id && song.slug && song.is_shareable !== false
        );

        const projectOwned = hasProjectAccess(project, access);
        const projectProduct = products.find(
          (product: any) =>
            product.project_id === project.id &&
            ["project_unlock", "project", "album", "album_unlock"].includes(String(product.product_type || ""))
        );

        const shareableSongs = songs.map((song) => {
          const songOwned = hasSongAccess(song, project, access);
          const shareCredits = countShareCredits(access, song, project);
          return {
            id: song.id,
            slug: song.slug,
            title: song.title || song.slug,
            artist: song.artist_name || "Caliph",
            projectId: project.id,
            projectSlug: project.slug,
            owned: songOwned,
            shareable: songOwned,
            shareCredits,
            accessLabel: songOwned ? (projectOwned ? "Project access" : "Song access") : "Locked",
          };
        });

        const ownedSongs = shareableSongs.filter((song) => song.owned);
        const projectShareable = projectOwned && ownedSongs.length > 0;

        return {
          id: project.id,
          slug: project.slug,
          name: titleForProject(project),
          owned: projectOwned,
          shareable: projectShareable,
          songCount: songs.length,
          shareableSongCount: ownedSongs.length,
          shareCredits: countShareCredits(access, null, project),
          unlockProductKey: projectProduct?.product_key || null,
          unlockPrice: formatMoney(projectProduct?.price_cents, projectProduct?.currency || "usd"),
          songs: shareableSongs,
        };
      })
    );

    const visibleProjects = results
      .filter((project) => project.songCount > 0)
      .sort((a, b) => Number(b.owned) - Number(a.owned) || a.name.localeCompare(b.name));

    return NextResponse.json({
      ok: true,
      user: { id: user.id, email: user.email, username: user.username },
      projects: visibleProjects,
      totals: {
        projects: visibleProjects.length,
        ownedProjects: visibleProjects.filter((project) => project.owned).length,
        shareableSongs: visibleProjects.reduce((sum, project) => sum + project.shareableSongCount, 0),
      },
      helperCopy:
        "Pick a song or full project. The recipient opens this same Share app, taps Receive, accepts your transfer, then gets a private guest listening link.",
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Could not load Share library." },
      { status: 500 }
    );
  }
}
