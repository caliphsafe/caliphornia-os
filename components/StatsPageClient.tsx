"use client";

import Link from "next/link";
import Image from "next/image";
import { useMemo, useState } from "react";
import styles from "@/app/apps/stats/stats.module.css";

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

  return { listening, favorites, reach };
}

function aggregateAppCounts(
  rows: Array<{ appSlug?: string; playCount?: number; uniqueListenerCount?: number }>,
  metric: "plays" | "reach" = "plays"
) {
  const map = new Map<string, number>();

  rows.forEach((row) => {
    const label = String(row.appSlug || "").trim();
    if (!label) return;

    const value =
      metric === "reach"
        ? row.uniqueListenerCount || 0
        : row.playCount || 0;

    map.set(label, (map.get(label) || 0) + value);
  });

  return Array.from(map.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

export default function StatsPageClient({
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
  const [activeTab, setActiveTab] = useState<"summary" | "songs" | "places">("summary");
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

  const topGlobalSong = globalSongs[0] || null;
  const topUserSong = userSongs[0] || null;
  const latestFavorite = favoriteSongs[0] || null;
  const topCity = topCities[0] || null;
  const topRegion = topRegions[0] || null;
  const topCountry = topCountries[0] || null;

  const userAppRows = useMemo(() => aggregateAppCounts(userSongs, "plays"), [userSongs]);
  const globalAppRows = useMemo(() => aggregateAppCounts(globalSongs, "plays"), [globalSongs]);

  const topUserApp = userAppRows[0] || null;
  const topGlobalApp = globalAppRows[0] || null;

  const rankedSummaryRows = useMemo(
    () => [
      {
        label: "Top Song",
        value: topGlobalSong?.title || "—",
        sub: topGlobalSong
          ? `${compactNumber(topGlobalSong.playCount || 0)} global plays`
          : "No data yet",
      },
      {
        label: "Top App",
        value: topGlobalApp?.label || "—",
        sub: topGlobalApp
          ? `${compactNumber(topGlobalApp.count || 0)} total plays`
          : "No data yet",
      },
      {
        label: "Top City",
        value: topCity?.label || "—",
        sub: topCity ? `${compactNumber(topCity.count || 0)} plays` : "No data yet",
      },
      {
        label: "Top Country",
        value: topCountry?.label || "—",
        sub: topCountry ? `${compactNumber(topCountry.count || 0)} plays` : "No data yet",
      },
    ],
    [topGlobalSong, topGlobalApp, topCity, topCountry]
  );

  return (
    <main className={styles.page}>
      <div className={styles.topChrome}>
        <Link href="/home" className={styles.backPill} aria-label="Back to Home">
          <Image
            src="/apps/stats/back.png"
            alt="Back"
            width={22}
            height={22}
            className={styles.backImg}
          />
        </Link>

        <div className={styles.userChip} title={username ? `@${username}` : "@user"}>
          @{username || "user"}
        </div>
      </div>

      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Your Listening Summary</h1>
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
                ["--listening" as any]: `${ringPercents.listening}%`,
                ["--favorites" as any]: `${ringPercents.favorites}%`,
                ["--reach" as any]: `${ringPercents.reach}%`,
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
              <strong>Your Listening</strong>
              <span>{compactNumber(totals.totalUserPlays)} total plays</span>
            </div>
          </div>

          <div className={styles.legendRow}>
            <span className={`${styles.legendDot} ${styles.favoritesDot}`} />
            <div>
              <strong>Your Favorites</strong>
              <span>{compactNumber(totals.totalFavoriteSongs)} songs saved</span>
            </div>
          </div>

          <div className={styles.legendRow}>
            <span className={`${styles.legendDot} ${styles.reachDot}`} />
            <div>
              <strong>Global Reach</strong>
              <span>{compactNumber(totals.totalGlobalReach)} listeners reached</span>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.twoColGrid}>
        <button className={`${styles.card} ${styles.tapCard}`} onClick={() => setActiveTab("summary")}>
          <div className={styles.cardHeaderMini}>
            <h3 className={styles.cardTitle}>Your Play Count</h3>
            <span className={styles.chev}>›</span>
          </div>
          <p className={styles.miniLabel}>Personal</p>
          <div className={styles.bigNumberPurple}>{compactNumber(totals.totalUserPlays)}</div>
          <div className={styles.sparkWrap}>
            {Array.from({ length: 24 }).map((_, i) => (
              <span
                key={`plays-${i}`}
                className={styles.sparkBar}
                style={{ height: `${16 + ((i * 9 + totals.totalUserPlays) % 70)}px` }}
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

        <button className={`${styles.card} ${styles.tapCard}`} onClick={() => setActiveTab("songs")}>
          <div className={styles.cardHeaderMini}>
            <h3 className={styles.cardTitle}>Global Listener Reach</h3>
            <span className={styles.chev}>›</span>
          </div>
          <p className={styles.miniLabel}>Global</p>
          <div className={styles.bigNumberBlue}>{compactNumber(totals.totalGlobalReach)}</div>
          <div className={styles.sparkWrap}>
            {Array.from({ length: 24 }).map((_, i) => (
              <span
                key={`reach-${i}`}
                className={`${styles.sparkBar} ${styles.sparkBarBlue}`}
                style={{ height: `${18 + ((i * 7 + totals.totalGlobalReach) % 68)}px` }}
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
          onClick={() => topUserSong && setSelectedSong(topUserSong)}
        >
          <div className={styles.cardHeaderMini}>
            <h3 className={styles.cardTitle}>Your Top Song</h3>
            <span className={styles.chev}>›</span>
          </div>

          {topUserSong?.coverImageUrl ? (
            <img
              src={topUserSong.coverImageUrl}
              alt={topUserSong.title}
              className={styles.sessionCover}
            />
          ) : (
            <div className={styles.sessionCoverFallback}>♪</div>
          )}

          <div className={styles.sessionTitle}>{topUserSong?.title || "No listens yet"}</div>
          <div className={styles.bigNumberGreen}>
            {compactNumber(topUserSong?.playCount || 0)} plays
          </div>
          <div className={styles.sessionDate}>
            {topUserSong?.lastPlayedAt ? formatShortDate(topUserSong.lastPlayedAt) : "—"}
          </div>
        </button>

        <button
          className={`${styles.card} ${styles.tapCard}`}
          onClick={() => latestFavorite && setSelectedSong(latestFavorite)}
        >
          <div className={styles.cardHeaderMini}>
            <h3 className={styles.cardTitle}>Your Latest Favorite</h3>
            <span className={styles.chev}>›</span>
          </div>

          {latestFavorite?.coverImageUrl ? (
            <img
              src={latestFavorite.coverImageUrl}
              alt={latestFavorite.title}
              className={styles.sessionCover}
            />
          ) : (
            <div className={styles.sessionCoverFallback}>♥</div>
          )}

          <div className={styles.sessionTitle}>{latestFavorite?.title || "No favorites yet"}</div>
          <div className={styles.bigNumberGreen}>
            {compactNumber(latestFavorite?.userPlayCount || 0)} plays
          </div>
          <div className={styles.sessionDate}>
            {latestFavorite?.favoritedAt ? formatShortDate(latestFavorite.favoritedAt) : "—"}
          </div>
        </button>
      </section>

      <section className={`${styles.card} ${styles.fullCard}`}>
        <div className={styles.cardHeaderMini}>
          <h3 className={styles.cardTitle}>Global Top Song</h3>
          <span className={styles.chev}>›</span>
        </div>

        {topGlobalSong ? (
          <button className={styles.highlightRowBtn} onClick={() => setSelectedSong(topGlobalSong)}>
            <div className={styles.highlightRow}>
              <div className={styles.highlightMedia}>
                {topGlobalSong.coverImageUrl ? (
                  <img src={topGlobalSong.coverImageUrl} alt={topGlobalSong.title} className={styles.highlightImg} />
                ) : (
                  <div className={styles.highlightFallback}>♪</div>
                )}
              </div>
              <div className={styles.highlightBody}>
                <div className={styles.highlightTitle}>{topGlobalSong.title}</div>
                <div className={styles.highlightSub}>{topGlobalSong.artistName || "Unknown artist"}</div>
                <div className={styles.highlightMeta}>
                  Global Plays {compactNumber(topGlobalSong.playCount || 0)} · Global Listeners{" "}
                  {compactNumber(topGlobalSong.uniqueListenerCount || 0)}
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
          <h3 className={styles.cardTitle}>Global Locations</h3>
          <span className={styles.chev}>›</span>
        </div>

        <div className={styles.locationGrid}>
          <button className={styles.locationCell} onClick={() => setActiveTab("places")}>
            <span className={styles.locationLabel}>Top City</span>
            <strong>{topCity?.label || "—"}</strong>
            <span>{compactNumber(topCity?.count || 0)} plays</span>
          </button>

          <button className={styles.locationCell} onClick={() => setActiveTab("places")}>
            <span className={styles.locationLabel}>Top State</span>
            <strong>{topRegion?.label || "—"}</strong>
            <span>{compactNumber(topRegion?.count || 0)} plays</span>
          </button>

          <button className={styles.locationCell} onClick={() => setActiveTab("places")}>
            <span className={styles.locationLabel}>Top Country</span>
            <strong>{topCountry?.label || "—"}</strong>
            <span>{compactNumber(topCountry?.count || 0)} plays</span>
          </button>

          <button className={styles.locationCell} onClick={() => setActiveTab("summary")}>
            <span className={styles.locationLabel}>Your Top App</span>
            <strong>{topUserApp?.label || "—"}</strong>
            <span>{compactNumber(topUserApp?.count || 0)} plays</span>
          </button>
        </div>
      </section>

      <section className={styles.bottomPanel}>
        <div className={styles.bottomContent}>
          {activeTab === "summary" && (
            <>
              <div className={styles.bottomKicker}>Your Listening Summary</div>
              <div className={styles.bottomTitle}>Your stats, global stats, and rankings</div>
              <div className={styles.bottomSub}>
                Your listening activity, your favorites, top apps, top global songs, and global location rankings all organized in one place.
              </div>

              <div className={styles.listStack}>
                <div className={styles.listRow}>
                  <div className={styles.listRowText}>
                    <strong>Your Top App</strong>
                    <span>Most-played project</span>
                  </div>
                  <div className={styles.listRowValue}>{topUserApp?.label || "—"}</div>
                </div>

                <div className={styles.listRow}>
                  <div className={styles.listRowText}>
                    <strong>Global Top App</strong>
                    <span>Most-played project overall</span>
                  </div>
                  <div className={styles.listRowValue}>{topGlobalApp?.label || "—"}</div>
                </div>

                {rankedSummaryRows.map((row) => (
                  <div key={row.label} className={styles.listRow}>
                    <div className={styles.listRowText}>
                      <strong>{row.label}</strong>
                      <span>{row.sub}</span>
                    </div>
                    <div className={styles.listRowValue}>{row.value}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          {activeTab === "songs" && (
            <>
              <div className={styles.bottomKicker}>Global Songs + Apps</div>

              <div className={styles.placesCols}>
                <div className={styles.placesCol}>
                  <strong>Top Songs</strong>
                  {globalSongs.slice(0, 5).map((song) => (
                    <button
                      key={song.songSlug}
                      className={styles.listRow}
                      onClick={() => setSelectedSong(song)}
                    >
                      <div className={styles.listRowText}>
                        <strong>{song.title}</strong>
                        <span>{song.appSlug || "Unknown app"}</span>
                      </div>
                      <div className={styles.listRowValue}>
                        {compactNumber(song.playCount || 0)}
                      </div>
                    </button>
                  ))}
                </div>

                <div className={styles.placesCol}>
                  <strong>Your Top Apps</strong>
                  {userAppRows.slice(0, 5).map((row) => (
                    <div key={row.label} className={styles.placeLine}>
                      <span>{row.label}</span>
                      <span>{compactNumber(row.count)}</span>
                    </div>
                  ))}
                </div>

                <div className={styles.placesCol}>
                  <strong>Global Top Apps</strong>
                  {globalAppRows.slice(0, 5).map((row) => (
                    <div key={row.label} className={styles.placeLine}>
                      <span>{row.label}</span>
                      <span>{compactNumber(row.count)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {activeTab === "places" && (
            <>
              <div className={styles.bottomKicker}>Global Locations</div>
              <div className={styles.placesCols}>
                <div className={styles.placesCol}>
                  <strong>Top Cities</strong>
                  {topCities.slice(0, 5).map((row) => (
                    <div key={row.label} className={styles.placeLine}>
                      <span>{row.label}</span>
                      <span>{compactNumber(row.count)}</span>
                    </div>
                  ))}
                </div>

                <div className={styles.placesCol}>
                  <strong>Top States</strong>
                  {topRegions.slice(0, 5).map((row) => (
                    <div key={row.label} className={styles.placeLine}>
                      <span>{row.label}</span>
                      <span>{compactNumber(row.count)}</span>
                    </div>
                  ))}
                </div>

                <div className={styles.placesCol}>
                  <strong>Top Countries</strong>
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
                    <span>Your Plays</span>
                    <strong>{compactNumber(selectedSong.userPlayCount || selectedSong.playCount || 0)}</strong>
                  </div>
                  <div>
                    <span>Global Reach</span>
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
