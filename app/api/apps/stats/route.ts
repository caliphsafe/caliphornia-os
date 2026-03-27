import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase-admin";

async function createSignedCoverUrl(storagePath: string | null | undefined) {
  if (!storagePath) return null;

  const { data, error } = await supabaseAdmin.storage
    .from("cover-art")
    .createSignedUrl(storagePath, 60 * 60);

  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("caliph_os_session")?.value ?? null;
    const session = verifySession(token);

    if (!session?.email) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized." },
        { status: 401 }
      );
    }

    const userEmail = session.email;

    const [globalStatsRes, userStatsRes, favoritesRes, songsRes] = await Promise.all([
      supabaseAdmin
        .from("global_song_stats")
        .select("song_id, song_slug, play_count, unique_listener_count"),

      supabaseAdmin
        .from("user_song_stats")
        .select("song_id, song_slug, play_count, last_played_at")
        .eq("user_email", userEmail),

      supabaseAdmin
        .from("user_favorite_songs")
        .select("song_id, song_slug, created_at")
        .eq("user_email", userEmail),

      supabaseAdmin
        .from("songs")
        .select(`
          id,
          slug,
          title,
          artist_name,
          producer_names,
          cover_image_path,
          source_app_slug,
          duration_label
        `)
    ]);

    if (globalStatsRes.error) {
      return NextResponse.json(
        { ok: false, error: globalStatsRes.error.message },
        { status: 500 }
      );
    }

    if (userStatsRes.error) {
      return NextResponse.json(
        { ok: false, error: userStatsRes.error.message },
        { status: 500 }
      );
    }

    if (favoritesRes.error) {
      return NextResponse.json(
        { ok: false, error: favoritesRes.error.message },
        { status: 500 }
      );
    }

    if (songsRes.error) {
      return NextResponse.json(
        { ok: false, error: songsRes.error.message },
        { status: 500 }
      );
    }

    const songs = songsRes.data || [];
    const songMap = new Map(songs.map((song) => [song.slug, song]));

    const favoriteSlugSet = new Set(
      (favoritesRes.data || []).map((row) => row.song_slug).filter(Boolean)
    );

    const favoriteCreatedAtMap = new Map(
      (favoritesRes.data || []).map((row) => [row.song_slug, row.created_at])
    );

    const mergedGlobal = await Promise.all(
      (globalStatsRes.data || []).map(async (row) => {
        const song = songMap.get(row.song_slug);
        const coverUrl = await createSignedCoverUrl(song?.cover_image_path);

        return {
          songSlug: row.song_slug,
          songId: row.song_id,
          title: song?.title || row.song_slug,
          artistName: song?.artist_name || "",
          producerNames: song?.producer_names || "",
          appSlug: song?.source_app_slug || "",
          durationLabel: song?.duration_label || "",
          coverImageUrl: coverUrl,
          playCount: row.play_count || 0,
          uniqueListenerCount: row.unique_listener_count || 0,
          isFavorite: favoriteSlugSet.has(row.song_slug)
        };
      })
    );

    const mergedUser = await Promise.all(
      (userStatsRes.data || []).map(async (row) => {
        const song = songMap.get(row.song_slug);
        const coverUrl = await createSignedCoverUrl(song?.cover_image_path);

        return {
          songSlug: row.song_slug,
          songId: row.song_id,
          title: song?.title || row.song_slug,
          artistName: song?.artist_name || "",
          producerNames: song?.producer_names || "",
          appSlug: song?.source_app_slug || "",
          durationLabel: song?.duration_label || "",
          coverImageUrl: coverUrl,
          playCount: row.play_count || 0,
          lastPlayedAt: row.last_played_at || null,
          isFavorite: favoriteSlugSet.has(row.song_slug)
        };
      })
    );

    const mergedFavorites = await Promise.all(
      Array.from(favoriteSlugSet).map(async (songSlug) => {
        const song = songMap.get(songSlug);
        const userStat = (userStatsRes.data || []).find((row) => row.song_slug === songSlug);
        const globalStat = (globalStatsRes.data || []).find((row) => row.song_slug === songSlug);
        const coverUrl = await createSignedCoverUrl(song?.cover_image_path);

        return {
          songSlug,
          title: song?.title || songSlug,
          artistName: song?.artist_name || "",
          producerNames: song?.producer_names || "",
          appSlug: song?.source_app_slug || "",
          durationLabel: song?.duration_label || "",
          coverImageUrl: coverUrl,
          favoritedAt: favoriteCreatedAtMap.get(songSlug) || null,
          userPlayCount: userStat?.play_count || 0,
          globalPlayCount: globalStat?.play_count || 0
        };
      })
    );

    mergedGlobal.sort((a, b) => b.playCount - a.playCount);
    mergedUser.sort((a, b) => (b.lastPlayedAt || "").localeCompare(a.lastPlayedAt || ""));
    mergedFavorites.sort((a, b) => (b.favoritedAt || "").localeCompare(a.favoritedAt || ""));

    const totals = {
      totalUserPlayedSongs: mergedUser.length,
      totalFavoriteSongs: mergedFavorites.length,
      totalUserPlays: mergedUser.reduce((sum, row) => sum + (row.playCount || 0), 0)
    };

    return NextResponse.json({
      ok: true,
      totals,
      globalSongs: mergedGlobal,
      userSongs: mergedUser,
      favoriteSongs: mergedFavorites
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Server error." },
      { status: 500 }
    );
  }
}
