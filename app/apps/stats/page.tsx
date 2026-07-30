import { redirect } from "next/navigation";
import { readSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase-admin";
import StatsPageClient, { type ShareStatsPayload } from "@/components/StatsPageClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function createSignedCoverUrl(storagePath: string | null | undefined) {
  if (!storagePath) return null;
  const { data, error } = await supabaseAdmin.storage.from("cover-art").createSignedUrl(storagePath, 60 * 60);
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

type CountRow = { label: string; count: number };
type ListenerRow = { label: string; count: number };

function countByLabel(rows: { label: string }[]) {
  const map = new Map<string, number>();
  for (const row of rows) {
    const raw = String(row.label || "").trim();
    if (!raw) continue;
    let label = raw;
    try { label = decodeURIComponent(raw); } catch { label = raw.replace(/%20/g, " "); }
    map.set(label, (map.get(label) || 0) + 1);
  }
  return Array.from(map.entries()).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
}

function countAppsFromSongs(rows: Array<{ appSlug?: string; playCount?: number }>) {
  const map = new Map<string, number>();
  for (const row of rows) {
    const label = String(row.appSlug || "").trim();
    if (!label) continue;
    map.set(label, (map.get(label) || 0) + (row.playCount || 0));
  }
  return Array.from(map.entries()).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
}

async function safeQuery<T>(factory: () => PromiseLike<{ data: T[] | null; error: any }>) {
  try {
    const res = await factory();
    if (res.error) return [] as T[];
    return (res.data || []) as T[];
  } catch {
    return [] as T[];
  }
}

function labelFromUser(row: any, appUserMap: Map<string, string>) {
  const email = String(row.sender_email_snapshot || row.user_email || "").toLowerCase();
  return appUserMap.get(email) || row.metadata?.sender_label || email || "Caliphornia listener";
}

function titleFromShare(row: any) {
  const metadataTitle = Array.isArray(row.metadata?.share_song_titles) ? row.metadata.share_song_titles[0] : null;
  return row.song_title_snapshot || metadataTitle || row.project_name_snapshot || row.song_slug_snapshot || "Shared music";
}

function buildShareStats({
  shareSessions,
  shareEvents,
  guestClaims,
  appUserMap,
  userEmail,
  userId,
}: {
  shareSessions: any[];
  shareEvents: any[];
  guestClaims: any[];
  appUserMap: Map<string, string>;
  userEmail: string;
  userId?: string | null;
}): ShareStatsPayload {
  const userSessions = shareSessions.filter((row) => {
    const senderEmail = String(row.sender_email_snapshot || "").toLowerCase();
    return senderEmail === userEmail || (userId && row.sender_user_id === userId);
  });

  const topSharerRows = countByLabel(shareSessions.map((row) => ({ label: labelFromUser(row, appUserMap) }))).slice(0, 10);
  const mostSharedSongs = countByLabel(shareSessions.map((row) => ({ label: titleFromShare(row) }))).slice(0, 10);

  const acceptedStatuses = new Set(["accepted", "completed", "qualified", "claimed"]);
  const globalAccepted = shareSessions.filter((row) => acceptedStatuses.has(String(row.status || ""))).length || shareEvents.filter((row) => String(row.event_type || "").includes("accepted")).length;

  return {
    mySharesCreated: userSessions.length,
    myProjectShares: userSessions.filter((row) => row.share_scope === "project").length,
    mySongShares: userSessions.filter((row) => row.share_scope !== "project").length,
    globalSharesCreated: shareSessions.length,
    globalAcceptedShares: globalAccepted,
    globalProjectShares: shareSessions.filter((row) => row.share_scope === "project").length,
    globalSongShares: shareSessions.filter((row) => row.share_scope !== "project").length,
    accountsFromShare: guestClaims.length,
    topSharers: topSharerRows,
    mostSharedSongs,
  };
}

export default async function StatsPage() {
  const session = await readSession();
  if (!session?.email) redirect("/");
  const userEmail = session.email.trim().toLowerCase();

  const [appUsers, globalStats, userStats, favorites, songs, userEventLogs, globalEventLogs, allUserStats, shareSessions, shareEvents, guestClaims] = await Promise.all([
    safeQuery<any>(() => supabaseAdmin.from("app_users").select("id, email, username")),
    safeQuery<any>(() => supabaseAdmin.from("global_song_stats").select("song_id, song_slug, play_count, unique_listener_count")),
    safeQuery<any>(() => supabaseAdmin.from("user_song_stats").select("song_id, song_slug, play_count, last_played_at").eq("user_email", userEmail)),
    safeQuery<any>(() => supabaseAdmin.from("user_favorite_songs").select("song_id, song_slug, created_at").eq("user_email", userEmail).neq("status", "removed")),
    safeQuery<any>(() => supabaseAdmin.from("songs").select("id, slug, title, artist_name, producer_names, cover_image_path, source_app_slug, duration_label")),
    safeQuery<any>(() => supabaseAdmin.from("event_logs").select("country, region, city").eq("user_email", userEmail).eq("event_type", "song_play")),
    safeQuery<any>(() => supabaseAdmin.from("event_logs").select("country, region, city").eq("event_type", "song_play")),
    safeQuery<any>(() => supabaseAdmin.from("user_song_stats").select("user_email, play_count")),
    safeQuery<any>(() => supabaseAdmin.from("nearby_share_sessions").select("id,sender_user_id,sender_email_snapshot,song_slug_snapshot,song_title_snapshot,project_slug_snapshot,project_name_snapshot,share_scope,status,metadata,created_at")),
    safeQuery<any>(() => supabaseAdmin.from("nearby_share_events").select("event_type,event_status,created_at")),
    safeQuery<any>(() => supabaseAdmin.from("guest_account_claims").select("id,created_at")),
  ]);

  const appUser = appUsers.find((row) => String(row.email || "").toLowerCase() === userEmail);
  const songMap = new Map(songs.map((song) => [song.slug, song]));
  const favoriteSlugSet = new Set(favorites.map((row) => row.song_slug).filter(Boolean));
  const favoriteCreatedAtMap = new Map(favorites.map((row) => [row.song_slug, row.created_at]));

  const globalSongs: SongRow[] = await Promise.all(globalStats.map(async (row) => {
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
  }));

  const userSongs: SongRow[] = await Promise.all(userStats.map(async (row) => {
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
  }));

  const favoriteSongs: SongRow[] = await Promise.all(Array.from(favoriteSlugSet).map(async (songSlug) => {
    const song = songMap.get(songSlug);
    const userStat = userStats.find((row) => row.song_slug === songSlug);
    const globalStat = globalStats.find((row) => row.song_slug === songSlug);
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
  }));

  globalSongs.sort((a, b) => (b.playCount || 0) - (a.playCount || 0));
  userSongs.sort((a, b) => (b.playCount || 0) - (a.playCount || 0));
  favoriteSongs.sort((a, b) => (b.favoritedAt || "").localeCompare(a.favoritedAt || ""));

  const userTopCities = countByLabel(userEventLogs.map((row) => ({ label: row.city || "" })));
  const userTopRegions = countByLabel(userEventLogs.map((row) => ({ label: row.region || "" })));
  const userTopCountries = countByLabel(userEventLogs.map((row) => ({ label: row.country || "" })));
  const globalTopCities = countByLabel(globalEventLogs.map((row) => ({ label: row.city || "" })));
  const globalTopRegions = countByLabel(globalEventLogs.map((row) => ({ label: row.region || "" })));
  const globalTopCountries = countByLabel(globalEventLogs.map((row) => ({ label: row.country || "" })));
  const userAppRows = countAppsFromSongs(userSongs);
  const globalAppRows = countAppsFromSongs(globalSongs);

  const appUserMap = new Map(appUsers.map((row) => [String(row.email || "").toLowerCase(), row.username || ""]));
  const listenerMap = new Map<string, number>();
  for (const row of allUserStats) {
    const email = String(row.user_email || "").toLowerCase();
    if (!email) continue;
    listenerMap.set(email, (listenerMap.get(email) || 0) + (row.play_count || 0));
  }
  const topListeners: ListenerRow[] = Array.from(listenerMap.entries())
    .map(([email, count]) => ({ label: appUserMap.get(email) || email, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const sharingStats = buildShareStats({
    shareSessions,
    shareEvents,
    guestClaims,
    appUserMap,
    userEmail,
    userId: appUser?.id || null,
  });

  return (
    <StatsPageClient
      username={appUser?.username || session.username || ""}
      globalSongs={globalSongs}
      userSongs={userSongs}
      favoriteSongs={favoriteSongs}
      userTopCities={userTopCities}
      userTopRegions={userTopRegions}
      userTopCountries={userTopCountries}
      globalTopCities={globalTopCities}
      globalTopRegions={globalTopRegions}
      globalTopCountries={globalTopCountries}
      userAppRows={userAppRows}
      globalAppRows={globalAppRows}
      topListeners={topListeners}
      sharingStats={sharingStats}
    />
  );
}
