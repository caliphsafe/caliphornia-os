import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase-admin";
import StatsPageClient from "@/components/StatsPageClient";

async function createSignedCoverUrl(storagePath: string | null | undefined) {
  if (!storagePath) return null;

  const { data, error } = await supabaseAdmin.storage
    .from("cover-art")
    .createSignedUrl(storagePath, 60 * 60);

  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

type SongRow = {
  songSlug: string;
  title: string;
  artistName: string;
  producerNames: string;
  appSlug: string;
  durationLabel: string;
  coverImageUrl: string | null;
  playCount?: number;
  uniqueListenerCount?: number;
  lastPlayedAt?: string | null;
  favoritedAt?: string | null;
  userPlayCount?: number;
  globalPlayCount?: number;
};

type CountRow = {
  label: string;
  count: number;
};

function countByLabel(rows: { label: string }[]) {
  const map = new Map<string, number>();

  for (const row of rows) {
    const raw = String(row.label || "").trim();
    if (!raw) continue;

    let label = raw;
    try {
      label = decodeURIComponent(raw);
    } catch {
      label = raw.replace(/%20/g, " ");
    }

    map.set(label, (map.get(label) || 0) + 1);
  }

  return Array.from(map.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

export default async function StatsPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("caliph_os_session")?.value ?? null;
  const session = verifySession(token);

  if (!session?.email) {
    redirect("/");
  }

  const userEmail = session.email;

  const [globalStatsRes, userStatsRes, favoritesRes, songsRes, eventLogsRes] =
    await Promise.all([
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

      supabaseAdmin.from("songs").select(`
        id,
        slug,
        title,
        artist_name,
        producer_names,
        cover_image_path,
        source_app_slug,
        duration_label
      `),

      supabaseAdmin
        .from("event_logs")
        .select("country, region, city")
        .eq("user_email", userEmail),
    ]);

  if (
    globalStatsRes.error ||
    userStatsRes.error ||
    favoritesRes.error ||
    songsRes.error ||
    eventLogsRes.error
  ) {
    redirect("/home");
  }

  const songs = songsRes.data || [];
  const songMap = new Map(songs.map((song) => [song.slug, song]));

  const favoriteSlugSet = new Set(
    (favoritesRes.data || []).map((row) => row.song_slug).filter(Boolean)
  );

  const favoriteCreatedAtMap = new Map(
    (favoritesRes.data || []).map((row) => [row.song_slug, row.created_at])
  );

  const globalSongs: SongRow[] = await Promise.all(
    (globalStatsRes.data || []).map(async (row) => {
      const song = songMap.get(row.song_slug);
      const coverImageUrl = await createSignedCoverUrl(song?.cover_image_path);

      return {
        songSlug: row.song_slug,
        title: song?.title || row.song_slug,
        artistName: song?.artist_name || "",
        producerNames: song?.producer_names || "",
        appSlug: song?.source_app_slug || "",
        durationLabel: song?.duration_label || "",
        coverImageUrl,
        playCount: row.play_count || 0,
        uniqueListenerCount: row.unique_listener_count || 0,
      };
    })
  );

  const userSongs: SongRow[] = await Promise.all(
    (userStatsRes.data || []).map(async (row) => {
      const song = songMap.get(row.song_slug);
      const coverImageUrl = await createSignedCoverUrl(song?.cover_image_path);

      return {
        songSlug: row.song_slug,
        title: song?.title || row.song_slug,
        artistName: song?.artist_name || "",
        producerNames: song?.producer_names || "",
        appSlug: song?.source_app_slug || "",
        durationLabel: song?.duration_label || "",
        coverImageUrl,
        playCount: row.play_count || 0,
        lastPlayedAt: row.last_played_at || null,
      };
    })
  );

  const favoriteSongs: SongRow[] = await Promise.all(
    Array.from(favoriteSlugSet).map(async (songSlug) => {
      const song = songMap.get(songSlug);
      const userStat = (userStatsRes.data || []).find(
        (row) => row.song_slug === songSlug
      );
      const globalStat = (globalStatsRes.data || []).find(
        (row) => row.song_slug === songSlug
      );
      const coverImageUrl = await createSignedCoverUrl(song?.cover_image_path);

      return {
        songSlug,
        title: song?.title || songSlug,
        artistName: song?.artist_name || "",
        producerNames: song?.producer_names || "",
        appSlug: song?.source_app_slug || "",
        durationLabel: song?.duration_label || "",
        coverImageUrl,
        favoritedAt: favoriteCreatedAtMap.get(songSlug) || null,
        userPlayCount: userStat?.play_count || 0,
        globalPlayCount: globalStat?.play_count || 0,
      };
    })
  );

  globalSongs.sort((a, b) => (b.playCount || 0) - (a.playCount || 0));
  userSongs.sort((a, b) => (b.lastPlayedAt || "").localeCompare(a.lastPlayedAt || ""));
  favoriteSongs.sort((a, b) => (b.favoritedAt || "").localeCompare(a.favoritedAt || ""));

  const eventLogs = eventLogsRes.data || [];

  const topCities = countByLabel(eventLogs.map((row) => ({ label: row.city || "" })));
  const topRegions = countByLabel(eventLogs.map((row) => ({ label: row.region || "" })));
  const topCountries = countByLabel(eventLogs.map((row) => ({ label: row.country || "" })));

  return (
    <StatsPageClient
      username={session.username || "user"}
      globalSongs={globalSongs}
      userSongs={userSongs}
      favoriteSongs={favoriteSongs}
      topCities={topCities}
      topRegions={topRegions}
      topCountries={topCountries}
    />
  );
}
