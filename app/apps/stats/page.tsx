"use client";

import { useMemo, useState } from "react";
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
  const listening = clampPercent((totalUserPlays / 200) * 100);
  const favorites = clampPercent((totalFavoriteSongs / 10) * 100);
  const reach = clampPercent((totalGlobalReach / 25) * 100);

  return {
    listening,
    favorites,
    reach,
  };
}

function buildAwards({
  totalUserPlays,
  totalFavoriteSongs,
  topCity,
}: {
  totalUserPlays: number;
  totalFavoriteSongs: number;
  topCity: CountRow | null;
}) {
  const awards: {
    id: string;
    title: string;
    subtitle: string;
    earned: boolean;
  }[] = [
    {
      id: "first-favorite",
      title: "First Favorite",
      subtitle:
        totalFavoriteSongs > 0
          ? "You saved your first song"
          : "Save your first song to unlock",
      earned: totalFavoriteSongs > 0,
    },
    {
      id: "hundred-plays",
      title: "100 Plays Club",
      subtitle:
        totalUserPlays >= 100
          ? `${compactNumber(totalUserPlays)} total plays`
          : "Reach 100 total plays to unlock",
      earned: totalUserPlays >= 100,
    },
    {
      id: "top-city",
      title: "City Signal",
      subtitle:
        topCity
          ? `Your strongest city is ${topCity.label}`
          : "Location activity needed to unlock",
      earned: Boolean(topCity),
    },
  ];

  return awards;
}

function StatsClientPage({
  username,
  globalSongs,
  userSongs,
  favoriteSongs,
  topCities,
  topRegions,
  topCountries,
}: {
  username: string;
  globalSongs: SongRow[];
  userSongs: SongRow[];
  favoriteSongs: SongRow[];
  topCities: CountRow[];
  topRegions: CountRow[];
  topCountries: CountRow[];
}) {
  const [activeTab, setActiveTab] = useState<"summary" | "songs" | "awards" | "places">("summary");
  const [selectedSong, setSelectedSong] = useState<SongRow | null>(null);

  const totals = useMemo(
    () => ({
      totalUserPlays: userSongs.reduce((sum, row) => sum + (row.playCount || 0), 0),
      totalFavoriteSongs: favoriteSongs.length,
      totalGlobalPlays: globalSongs.reduce((sum, row) => sum + (row.playCount || 0), 0),
      totalGlobalReach: globalSongs.reduce((sum, row) => sum + (row.uniqueListenerCount || 0), 0),
    }),
    [userSongs, favoriteSongs, globalSongs]
  );

  const ringPercents = getRingPercents(totals);

  const topSong = globalSongs[0] || null;
  const latestListen = userSongs[0] || null;
  const latestFavorite = favoriteSongs[0] || null;
  const topCity = topCities[0] || null;
  const topRegion = topRegions[0] || null;
  const topCountry = topCountries[0] || null;

  const awards = buildAwards({
    totalUserPlays: totals.totalUserPlays,
    totalFavoriteSongs: totals.totalFavoriteSongs,
    topCity,
  });

  const songsForTab =
    activeTab === "songs"
      ? [...globalSongs]
      : activeTab === "places"
      ? [...userSongs]
      : [...globalSongs];

  return (
    <main className={styles.page}>
      <div className={styles.topChrome}>
        <a href="/home" className={styles.backPill} aria-label="Back to Home">
          <span className={styles.backChevron}>‹</span>
        </a>

        <div className={styles.userChip}>
          @{username || "user"}
        </div>
      </div>

      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Summary</h1>
          <p className={styles.date}>{formatHeaderDate()}</p>
        </div>
      </div>

      <section className={`${styles.card} ${styles.ringsCard}`}>
        <div>
          <h2 className={styles.cardTitle}>Listening Rings</h2>

          <div
            className={styles.rings}
            style={
              {
                "--listening": `${ringPercents.listening}%`,
                "--favorites": `${ringPercents.favorites}%`,
                "--reach": `${ringPercents.reach}%`,
              } as React.CSSProperties
            }
          >
            <div className={`${styles.ring} ${styles.ringListening}`} />
            <div className={`${styles.ring} ${styles.ringFavorites}`} />
            <div className={`${styles.ring} ${styles.ringReach}`} />
            <div className={styles.ringsCenter} />
          </div>
        </div>

        <div className={styles.ringLegend}>
          <div className={styles.legendRow}>
            <span className={`${styles.legendDot} ${styles.listeningDot}`} />
            <div>
              <strong>Listening</strong>
              <span>{compactNumber(totals.totalUserPlays)} total plays</span>
            </div>
          </div>

          <div className={styles.legendRow}>
            <span className={`${styles.legendDot} ${styles.favoritesDot}`} />
            <div>
              <strong>Favorites</strong>
              <span>{compactNumber(totals.totalFavoriteSongs)} songs saved</span>
            </div>
          </div>

          <div className={styles.legendRow}>
            <span className={`${styles.legendDot} ${styles.reachDot}`} />
            <div>
              <strong>Reach</strong>
              <span>{compactNumber(totals.totalGlobalReach)} listeners reached</span>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.twoColGrid}>
        <button className={`${styles.card} ${styles.tapCard}`} onClick={() => setActiveTab("summary")}>
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
        </button>

        <button className={`${styles.card} ${styles.tapCard}`} onClick={() => setActiveTab("places")}>
          <div className={styles.cardHeaderMini}>
            <h3 className={styles.cardTitle}>Listener Reach</h3>
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
        </button>

        <button
          className={`${styles.card} ${styles.tapCard}`}
          onClick={() => latestListen && setSelectedSong(latestListen)}
        >
          <div className={styles.cardHeaderMini}>
            <h3 className={styles.cardTitle}>Recent Listen</h3>
            <span className={styles.chev}>›</span>
          </div>

          {latestListen?.coverImageUrl ? (
            <img
              src={latestListen.coverImageUrl}
              alt={latestListen.title}
              className={styles.sessionCover}
            />
          ) : (
            <div className={styles.sessionCoverFallback}>♪</div>
          )}

          <div className={styles.sessionTitle}>{latestListen?.title || "No recent listen"}</div>
          <div className={styles.bigNumberGreen}>
            {compactNumber(latestListen?.playCount || 0)} plays
          </div>
          <div className={styles.sessionDate}>
            {latestListen?.lastPlayedAt ? formatShortDate(latestListen.lastPlayedAt) : "—"}
          </div>
        </button>

        <button className={`${styles.card} ${styles.tapCard}`} onClick={() => setActiveTab("awards")}>
          <div className={styles.cardHeaderMini}>
            <h3 className={styles.cardTitle}>Milestones</h3>
            <span className={styles.chev}>›</span>
          </div>

          <div className={styles.awardBadge}>
            {awards.filter((award) => award.earned).length}
          </div>
          <div className={styles.awardTitle}>Unlocked Achievements</div>
          <div className={styles.awardSub}>
            {awards.filter((award) => award.earned).length} of {awards.length} earned
          </div>
          <div className={styles.awardDate}>Live progress</div>
        </button>
      </section>

      <section className={`${styles.card} ${styles.fullCard}`}>
        <div className={styles.cardHeaderMini}>
          <h3 className={styles.cardTitle}>Top Song</h3>
          <span className={styles.chev}>›</span>
        </div>

        {topSong ? (
          <button className={styles.highlightRowBtn} onClick={() => setSelectedSong(topSong)}>
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
          </button>
        ) : (
          <p className={styles.emptyText}>No top song yet.</p>
        )}
      </section>

      <section className={`${styles.card} ${styles.fullCard}`}>
        <div className={styles.cardHeaderMini}>
          <h3 className={styles.cardTitle}>Locations</h3>
          <span className={styles.chev}>›</span>
        </div>

        <div className={styles.locationGrid}>
          <button className={styles.locationCell} onClick={() => setActiveTab("places")}>
            <span className={styles.locationLabel}>Top City</span>
            <strong>{topCity?.label || "—"}</strong>
            <span>{compactNumber(topCity?.count || 0)} events</span>
          </button>

          <button className={styles.locationCell} onClick={() => setActiveTab("places")}>
            <span className={styles.locationLabel}>Top Region</span>
            <strong>{topRegion?.label || "—"}</strong>
            <span>{compactNumber(topRegion?.count || 0)} events</span>
          </button>

          <button className={styles.locationCell} onClick={() => setActiveTab("places")}>
            <span className={styles.locationLabel}>Top Country</span>
            <strong>{topCountry?.label || "—"}</strong>
            <span>{compactNumber(topCountry?.count || 0)} events</span>
          </button>

          <button className={styles.locationCell} onClick={() => setActiveTab("places")}>
            <span className={styles.locationLabel}>Favorites</span>
            <strong>{compactNumber(totals.totalFavoriteSongs)}</strong>
            <span>saved songs</span>
          </button>
        </div>
      </section>

      <section className={styles.bottomPanel}>
        <div className={styles.bottomContent}>
          {activeTab === "summary" && (
            <>
              <div className={styles.bottomKicker}>Listening Overview</div>
              <div className={styles.bottomTitle}>Your music world in motion</div>
              <div className={styles.bottomSub}>
                Plays, favorites, reach, recent listens, and location signals all in one place.
              </div>
            </>
          )}

          {activeTab === "songs" && (
            <>
              <div className={styles.bottomKicker}>Top Songs</div>
              <div className={styles.listStack}>
                {globalSongs.slice(0, 5).map((song) => (
                  <button
                    key={song.songSlug}
                    className={styles.listRow}
                    onClick={() => setSelectedSong(song)}
                  >
                    <div className={styles.listRowText}>
                      <strong>{song.title}</strong>
                      <span>{song.artistName || "Unknown artist"}</span>
                    </div>
                    <div className={styles.listRowValue}>{compactNumber(song.playCount || 0)}</div>
                  </button>
                ))}
              </div>
            </>
          )}

          {activeTab === "awards" && (
            <>
              <div className={styles.bottomKicker}>Awards</div>
              <div className={styles.listStack}>
                {awards.map((award) => (
                  <div key={award.id} className={styles.awardRow}>
                    <div className={`${styles.awardDot} ${award.earned ? styles.awardDotOn : ""}`} />
                    <div className={styles.listRowText}>
                      <strong>{award.title}</strong>
                      <span>{award.subtitle}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {activeTab === "places" && (
            <>
              <div className={styles.bottomKicker}>Places</div>
              <div className={styles.placesCols}>
                <div className={styles.placesCol}>
                  <strong>Cities</strong>
                  {topCities.slice(0, 5).map((row) => (
                    <div key={row.label} className={styles.placeLine}>
                      <span>{row.label}</span>
                      <span>{compactNumber(row.count)}</span>
                    </div>
                  ))}
                </div>

                <div className={styles.placesCol}>
                  <strong>Countries</strong>
                  {topCountries.slice(0, 5).map((row) => (
                    <div key={row.label} className={styles.placeLine}>
                      <span>{row.label}</span>
                      <span>{compactNumber(row.count)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <div className={styles.bottomTabs}>
          <button
            className={`${styles.bottomTab} ${activeTab === "summary" ? styles.bottomTabActive : ""}`}
            onClick={() => setActiveTab("summary")}
          >
            Summary
          </button>
          <button
            className={`${styles.bottomTab} ${activeTab === "songs" ? styles.bottomTabActive : ""}`}
            onClick={() => setActiveTab("songs")}
          >
            Songs
          </button>
          <button
            className={`${styles.bottomTab} ${activeTab === "awards" ? styles.bottomTabActive : ""}`}
            onClick={() => setActiveTab("awards")}
          >
            Awards
          </button>
          <button
            className={`${styles.bottomTab} ${activeTab === "places" ? styles.bottomTabActive : ""}`}
            onClick={() => setActiveTab("places")}
          >
            Places
          </button>
        </div>
      </section>

      {selectedSong ? (
        <div className={styles.modalOverlay} onClick={() => setSelectedSong(null)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <button className={styles.modalClose} onClick={() => setSelectedSong(null)}>
              ×
            </button>

            <div className={styles.modalBody}>
              <div className={styles.modalMedia}>
                {selectedSong.coverImageUrl ? (
                  <img src={selectedSong.coverImageUrl} alt={selectedSong.title} className={styles.modalImg} />
                ) : (
                  <div className={styles.modalFallback}>♪</div>
                )}
              </div>

              <div className={styles.modalCopy}>
                <h3>{selectedSong.title}</h3>
                <p>{selectedSong.artistName || "Unknown artist"}</p>

                <div className={styles.modalStats}>
                  <div>
                    <span>App</span>
                    <strong>{selectedSong.appSlug || "—"}</strong>
                  </div>
                  <div>
                    <span>Duration</span>
                    <strong>{selectedSong.durationLabel || "—"}</strong>
                  </div>
                  <div>
                    <span>Plays</span>
                    <strong>{compactNumber(selectedSong.playCount || selectedSong.userPlayCount || 0)}</strong>
                  </div>
                  <div>
                    <span>Reach</span>
                    <strong>{compactNumber(selectedSong.uniqueListenerCount || selectedSong.globalPlayCount || 0)}</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
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

  const topCities = countByLabel(eventLogs.map((row) => ({ label: row.city || "" })));
  const topRegions = countByLabel(eventLogs.map((row) => ({ label: row.region || "" })));
  const topCountries = countByLabel(eventLogs.map((row) => ({ label: row.country || "" })));

  return (
    <StatsClientPage
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
