import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase-admin";
import styles from "./stats.module.css";

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

function compactNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value || 0);
}

function formatHeaderDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(date);
}

function formatShortDate(value?: string | null) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString("en-US", {
      month: "numeric",
      day: "numeric",
      year: "2-digit",
    });
  } catch {
    return "—";
  }
}

function countByLabel(rows: { label: string }[]) {
  const map = new Map<string, number>();

  for (const row of rows) {
    const label = String(row.label || "").trim();
    if (!label) continue;
    map.set(label, (map.get(label) || 0) + 1);
  }

  return Array.from(map.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, value));
}

function getRingPercents({
  totalUserPlays,
  totalFavoriteSongs,
  totalGlobalReach,
}: {
  totalUserPlays: number;
  totalFavoriteSongs: number;
  totalGlobalReach: number;
}) {
  const move = clampPercent((totalUserPlays / 200) * 100);
  const exercise = clampPercent((totalFavoriteSongs / 10) * 100);
  const stand = clampPercent((totalGlobalReach / 25) * 100);

  return {
    move,
    exercise,
    stand,
  };
}

export default async function StatsPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("caliph_os_session")?.value ?? null;
  const session = verifySession(token);

  if (!session?.email) {
    redirect("/");
  }

  const userEmail = session.email;

  const [globalStatsRes, userStatsRes, favoritesRes, songsRes, eventLogsRes] = await Promise.all([
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
      `),

    supabaseAdmin
      .from("event_logs")
      .select("country, region, city, platform")
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
      const userStat = (userStatsRes.data || []).find((row) => row.song_slug === songSlug);
      const globalStat = (globalStatsRes.data || []).find((row) => row.song_slug === songSlug);
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

  const topCities = countByLabel(
    eventLogs.map((row) => ({ label: row.city || "" }))
  );

  const topRegions = countByLabel(
    eventLogs.map((row) => ({ label: row.region || "" }))
  );

  const topCountries = countByLabel(
    eventLogs.map((row) => ({ label: row.country || "" }))
  );

  const topPlatforms = countByLabel(
    eventLogs.map((row) => ({ label: row.platform || "" }))
  );

  const totals = {
    totalUserPlays: userSongs.reduce((sum, row) => sum + (row.playCount || 0), 0),
    totalFavoriteSongs: favoriteSongs.length,
    totalGlobalPlays: globalSongs.reduce((sum, row) => sum + (row.playCount || 0), 0),
    totalGlobalReach: globalSongs.reduce((sum, row) => sum + (row.uniqueListenerCount || 0), 0),
  };

  const ringPercents = getRingPercents(totals);

  const topSong = globalSongs[0] || null;
  const latestSession = userSongs[0] || null;
  const latestFavorite = favoriteSongs[0] || null;
  const topCity = topCities[0] || null;
  const topPlatform = topPlatforms[0] || null;

  return (
    <main className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Summary</h1>
          <p className={styles.date}>{formatHeaderDate()}</p>
        </div>

        <a href="/home" className={styles.profileBtn} aria-label="Back to Home">
          {topSong?.coverImageUrl ? (
            <img src={topSong.coverImageUrl} alt="Profile" className={styles.profileImg} />
          ) : (
            <span>{(session.username || "U").slice(0, 1).toUpperCase()}</span>
          )}
        </a>
      </div>

      <section className={`${styles.card} ${styles.ringsCard}`}>
        <div>
          <h2 className={styles.cardTitle}>Activity Rings</h2>

          <div
            className={styles.rings}
            style={
              {
                "--move": `${ringPercents.move}%`,
                "--exercise": `${ringPercents.exercise}%`,
                "--stand": `${ringPercents.stand}%`,
              } as React.CSSProperties
            }
          >
            <div className={`${styles.ring} ${styles.ringMove}`} />
            <div className={`${styles.ring} ${styles.ringExercise}`} />
            <div className={`${styles.ring} ${styles.ringStand}`} />
            <div className={styles.ringsCenter} />
          </div>
        </div>

        <div className={styles.ringLegend}>
          <div className={styles.legendRow}>
            <span className={`${styles.legendDot} ${styles.moveDot}`} />
            <div>
              <strong>Move</strong>
              <span>{compactNumber(totals.totalUserPlays)} plays</span>
            </div>
          </div>

          <div className={styles.legendRow}>
            <span className={`${styles.legendDot} ${styles.exerciseDot}`} />
            <div>
              <strong>Favorites</strong>
              <span>{compactNumber(totals.totalFavoriteSongs)} saved songs</span>
            </div>
          </div>

          <div className={styles.legendRow}>
            <span className={`${styles.legendDot} ${styles.standDot}`} />
            <div>
              <strong>Reach</strong>
              <span>{compactNumber(totals.totalGlobalReach)} listeners reached</span>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.twoColGrid}>
        <article className={styles.card}>
          <div className={styles.cardHeaderMini}>
            <h3 className={styles.cardTitle}>Play Count</h3>
            <span className={styles.chev}>›</span>
          </div>
          <p className={styles.miniLabel}>Today</p>
          <div className={styles.bigNumberPurple}>{compactNumber(totals.totalUserPlays)}</div>
          <div className={styles.sparkWrap}>
            {Array.from({ length: 24 }).map((_, i) => (
              <span
                key={`plays-${i}`}
                className={styles.sparkBar}
                style={{
                  height: `${16 + ((i * 9 + totals.totalUserPlays) % 70)}px`,
                }}
              />
            ))}
          </div>
          <div className={styles.sparkTimeline}>
            <span>12 AM</span>
            <span>6 AM</span>
            <span>12 PM</span>
            <span>6 PM</span>
          </div>
        </article>

        <article className={styles.card}>
          <div className={styles.cardHeaderMini}>
            <h3 className={styles.cardTitle}>Global Reach</h3>
            <span className={styles.chev}>›</span>
          </div>
          <p className={styles.miniLabel}>Today</p>
          <div className={styles.bigNumberBlue}>{compactNumber(totals.totalGlobalReach)}</div>
          <div className={styles.sparkWrap}>
            {Array.from({ length: 24 }).map((_, i) => (
              <span
                key={`reach-${i}`}
                className={`${styles.sparkBar} ${styles.sparkBarBlue}`}
                style={{
                  height: `${18 + ((i * 7 + totals.totalGlobalReach) % 68)}px`,
                }}
              />
            ))}
          </div>
          <div className={styles.sparkTimeline}>
            <span>12 AM</span>
            <span>6 AM</span>
            <span>12 PM</span>
            <span>6 PM</span>
          </div>
        </article>

        <article className={styles.card}>
          <div className={styles.cardHeaderMini}>
            <h3 className={styles.cardTitle}>Sessions</h3>
            <span className={styles.chev}>›</span>
          </div>

          {latestSession?.coverImageUrl ? (
            <img
              src={latestSession.coverImageUrl}
              alt={latestSession.title}
              className={styles.sessionCover}
            />
          ) : (
            <div className={styles.sessionCoverFallback}>♪</div>
          )}

          <div className={styles.sessionTitle}>{latestSession?.title || "No recent session"}</div>
          <div className={styles.bigNumberGreen}>
            {compactNumber(latestSession?.playCount || 0)} plays
          </div>
          <div className={styles.sessionDate}>
            {latestSession?.lastPlayedAt ? formatShortDate(latestSession.lastPlayedAt) : "—"}
          </div>
        </article>

        <article className={styles.card}>
          <div className={styles.cardHeaderMini}>
            <h3 className={styles.cardTitle}>Awards</h3>
            <span className={styles.chev}>›</span>
          </div>

          <div className={styles.awardBadge}>★</div>
          <div className={styles.awardTitle}>
            {latestFavorite ? "Latest Favorite Added" : "No awards yet"}
          </div>
          <div className={styles.awardSub}>
            {latestFavorite
              ? `${latestFavorite.title}`
              : "Start saving songs to unlock moments"}
          </div>
          <div className={styles.awardDate}>
            {latestFavorite?.favoritedAt ? formatShortDate(latestFavorite.favoritedAt) : "—"}
          </div>
        </article>
      </section>

      <section className={`${styles.card} ${styles.fullCard}`}>
        <div className={styles.cardHeaderMini}>
          <h3 className={styles.cardTitle}>Top Song</h3>
          <span className={styles.chev}>›</span>
        </div>

        {topSong ? (
          <div className={styles.highlightRow}>
            <div className={styles.highlightMedia}>
              {topSong.coverImageUrl ? (
                <img src={topSong.coverImageUrl} alt={topSong.title} className={styles.highlightImg} />
              ) : (
                <div className={styles.highlightFallback}>♪</div>
              )}
            </div>
            <div className={styles.highlightBody}>
              <div className={styles.highlightTitle}>{topSong.title}</div>
              <div className={styles.highlightSub}>{topSong.artistName || "Unknown artist"}</div>
              <div className={styles.highlightMeta}>
                {compactNumber(topSong.playCount || 0)} plays ·{" "}
                {compactNumber(topSong.uniqueListenerCount || 0)} listeners
              </div>
            </div>
          </div>
        ) : (
          <p className={styles.emptyText}>No top song yet.</p>
        )}
      </section>

      <section className={`${styles.card} ${styles.fullCard}`}>
        <div className={styles.cardHeaderMini}>
          <h3 className={styles.cardTitle}>Location + Platform</h3>
          <span className={styles.chev}>›</span>
        </div>

        <div className={styles.locationGrid}>
          <div className={styles.locationCell}>
            <span className={styles.locationLabel}>Top City</span>
            <strong>{topCity?.label || "—"}</strong>
            <span>{compactNumber(topCity?.count || 0)} events</span>
          </div>

          <div className={styles.locationCell}>
            <span className={styles.locationLabel}>Top Platform</span>
            <strong>{topPlatform?.label || "—"}</strong>
            <span>{compactNumber(topPlatform?.count || 0)} events</span>
          </div>

          <div className={styles.locationCell}>
            <span className={styles.locationLabel}>Top Region</span>
            <strong>{topRegions[0]?.label || "—"}</strong>
            <span>{compactNumber(topRegions[0]?.count || 0)} events</span>
          </div>

          <div className={styles.locationCell}>
            <span className={styles.locationLabel}>Top Country</span>
            <strong>{topCountries[0]?.label || "—"}</strong>
            <span>{compactNumber(topCountries[0]?.count || 0)} events</span>
          </div>
        </div>
      </section>

      <section className={styles.bottomPanel}>
        <div className={styles.bottomHero}>
          <div className={styles.bottomKicker}>Caliphornia Stats+</div>
          <div className={styles.bottomTitle}>Your music world in motion</div>
          <div className={styles.bottomSub}>
            Plays, favorites, reach, sessions, platform activity, and location signals all in one place.
          </div>
        </div>

        <div className={styles.bottomTabs}>
          <div className={`${styles.bottomTab} ${styles.bottomTabActive}`}>Summary</div>
          <div className={styles.bottomTab}>Top Songs</div>
          <div className={styles.bottomTab}>Sessions</div>
          <div className={styles.bottomTab}>Places</div>
        </div>
      </section>
    </main>
  );
}
