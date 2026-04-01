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

type ListenerRow = {
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

export default function StatsPageClient({
  username,
  globalSongs,
  userSongs,
  favoriteSongs,
  userTopCities,
  userTopRegions,
  userTopCountries,
  globalTopCities,
  globalTopRegions,
  globalTopCountries,
  userAppRows,
  globalAppRows,
  topListeners,
}: {
  username: string;
  globalSongs: SongRow[];
  userSongs: SongRow[];
  favoriteSongs: SongRow[];
  userTopCities: CountRow[];
  userTopRegions: CountRow[];
  userTopCountries: CountRow[];
  globalTopCities: CountRow[];
  globalTopRegions: CountRow[];
  globalTopCountries: CountRow[];
  userAppRows: CountRow[];
  globalAppRows: CountRow[];
  topListeners: ListenerRow[];
}) {
  const [activeTab, setActiveTab] = useState<"user" | "global">("user");
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

  const topUserSong = userSongs[0] || null;
  const topGlobalSong = globalSongs[0] || null;
  const latestFavorite = favoriteSongs[0] || null;

  const topUserCity = userTopCities[0] || null;
  const topUserRegion = userTopRegions[0] || null;
  const topUserCountry = userTopCountries[0] || null;

  const topGlobalCity = globalTopCities[0] || null;
  const topGlobalRegion = globalTopRegions[0] || null;
  const topGlobalCountry = globalTopCountries[0] || null;

  const topUserApp = userAppRows[0] || null;
  const topGlobalApp = globalAppRows[0] || null;

  const userRankingRows = useMemo(
    () => [
      {
        label: "Top Song",
        value: topUserSong?.title || "—",
        meta: topUserSong ? `${compactNumber(topUserSong.playCount || 0)} plays` : "No data yet",
      },
      {
        label: "Top App",
        value: topUserApp?.label || "—",
        meta: topUserApp ? `${compactNumber(topUserApp.count || 0)} plays` : "No data yet",
      },
      {
        label: "Top City",
        value: topUserCity?.label || "—",
        meta: topUserCity ? `${compactNumber(topUserCity.count || 0)} plays` : "No data yet",
      },
      {
        label: "Top Country",
        value: topUserCountry?.label || "—",
        meta: topUserCountry ? `${compactNumber(topUserCountry.count || 0)} plays` : "No data yet",
      },
    ],
    [topUserSong, topUserApp, topUserCity, topUserCountry]
  );

  const globalRankingRows = useMemo(
    () => [
      {
        label: "Top Song",
        value: topGlobalSong?.title || "—",
        meta: topGlobalSong ? `${compactNumber(topGlobalSong.playCount || 0)} plays` : "No data yet",
      },
      {
        label: "Top App",
        value: topGlobalApp?.label || "—",
        meta: topGlobalApp ? `${compactNumber(topGlobalApp.count || 0)} plays` : "No data yet",
      },
      {
        label: "Top City",
        value: topGlobalCity?.label || "—",
        meta: topGlobalCity ? `${compactNumber(topGlobalCity.count || 0)} plays` : "No data yet",
      },
      {
        label: "Top Country",
        value: topGlobalCountry?.label || "—",
        meta: topGlobalCountry ? `${compactNumber(topGlobalCountry.count || 0)} plays` : "No data yet",
      },
    ],
    [topGlobalSong, topGlobalApp, topGlobalCity, topGlobalCountry]
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
          <h1 className={styles.title}>{username ? `${username}'s Listening Summary` : "Your Listening Summary"}</h1>
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
              <strong>{username ? `${username}'s Listening` : "Your Listening"}</strong>
              <span>{compactNumber(totals.totalUserPlays)} total plays</span>
            </div>
          </div>

          <div className={styles.legendRow}>
            <span className={`${styles.legendDot} ${styles.favoritesDot}`} />
            <div>
              <strong>{username ? `${username}'s Favorites` : "Your Favorites"}</strong>
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

      {/* USER STATS */}
      <section className={`${styles.card} ${styles.fullCard}`}>
        <div className={styles.cardHeaderMini}>
          <h3 className={styles.cardTitle}>{username ? `${username}'s Listening` : "Your Listening"}</h3>
          <span className={styles.chev}>›</span>
        </div>

        <div className={styles.twoColGrid}>
          <button className={`${styles.card} ${styles.tapCard}`} onClick={() => setActiveTab("user")}>
            <div className={styles.cardHeaderMini}>
              <h3 className={styles.cardTitle}>Total Plays</h3>
              <span className={styles.chev}>›</span>
            </div>
            <p className={styles.miniLabel}>Personal activity</p>
            <div className={styles.bigNumberPurple}>{compactNumber(totals.totalUserPlays)}</div>
            <div className={styles.sparkWrap}>
              {Array.from({ length: 24 }).map((_, i) => (
                <span
                  key={`user-plays-${i}`}
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

          <button
            className={`${styles.card} ${styles.tapCard}`}
            onClick={() => topUserSong && setSelectedSong(topUserSong)}
          >
            <div className={styles.cardHeaderMini}>
              <h3 className={styles.cardTitle}>Top Song</h3>
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

            <div className={styles.sessionTitle}>{topUserSong?.title || "No listening yet"}</div>
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
              <h3 className={styles.cardTitle}>Latest Favorite</h3>
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
              {compactNumber(totals.totalFavoriteSongs)} saved
            </div>
            <div className={styles.sessionDate}>
              {latestFavorite?.favoritedAt ? formatShortDate(latestFavorite.favoritedAt) : "—"}
            </div>
          </button>

          <button className={`${styles.card} ${styles.tapCard}`} onClick={() => setActiveTab("user")}>
            <div className={styles.cardHeaderMini}>
              <h3 className={styles.cardTitle}>Top App</h3>
              <span className={styles.chev}>›</span>
            </div>
            <p className={styles.miniLabel}>Most played project</p>
            <div className={styles.bigNumberBlue}>{topUserApp?.label || "—"}</div>
            <div className={styles.sessionDate}>
              {compactNumber(topUserApp?.count || 0)} plays
            </div>
          </button>
        </div>
      </section>

      {/* GLOBAL STATS */}
      <section className={`${styles.card} ${styles.fullCard}`}>
        <div className={styles.cardHeaderMini}>
          <h3 className={styles.cardTitle}>Global Stats</h3>
          <span className={styles.chev}>›</span>
        </div>

        <div className={styles.twoColGrid}>
          <button className={`${styles.card} ${styles.tapCard}`} onClick={() => setActiveTab("global")}>
            <div className={styles.cardHeaderMini}>
              <h3 className={styles.cardTitle}>Global Plays</h3>
              <span className={styles.chev}>›</span>
            </div>
            <p className={styles.miniLabel}>Overall activity</p>
            <div className={styles.bigNumberBlue}>{compactNumber(totals.totalGlobalPlays)}</div>
            <div className={styles.sparkWrap}>
              {Array.from({ length: 24 }).map((_, i) => (
                <span
                  key={`global-plays-${i}`}
                  className={`${styles.sparkBar} ${styles.sparkBarBlue}`}
                  style={{ height: `${18 + ((i * 7 + totals.totalGlobalPlays) % 68)}px` }}
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
            onClick={() => topGlobalSong && setSelectedSong(topGlobalSong)}
          >
            <div className={styles.cardHeaderMini}>
              <h3 className={styles.cardTitle}>Top Song</h3>
              <span className={styles.chev}>›</span>
            </div>

            {topGlobalSong?.coverImageUrl ? (
              <img
                src={topGlobalSong.coverImageUrl}
                alt={topGlobalSong.title}
                className={styles.sessionCover}
              />
            ) : (
              <div className={styles.sessionCoverFallback}>♪</div>
            )}

            <div className={styles.sessionTitle}>{topGlobalSong?.title || "No global song yet"}</div>
            <div className={styles.bigNumberGreen}>
              {compactNumber(topGlobalSong?.playCount || 0)} plays
            </div>
            <div className={styles.sessionDate}>
              {compactNumber(topGlobalSong?.uniqueListenerCount || 0)} listeners
            </div>
          </button>

          <button className={`${styles.card} ${styles.tapCard}`} onClick={() => setActiveTab("global")}>
            <div className={styles.cardHeaderMini}>
              <h3 className={styles.cardTitle}>Top App</h3>
              <span className={styles.chev}>›</span>
            </div>
            <p className={styles.miniLabel}>Most played project</p>
            <div className={styles.bigNumberBlue}>{topGlobalApp?.label || "—"}</div>
            <div className={styles.sessionDate}>
              {compactNumber(topGlobalApp?.count || 0)} plays
            </div>
          </button>

          <button className={`${styles.card} ${styles.tapCard}`} onClick={() => setActiveTab("global")}>
            <div className={styles.cardHeaderMini}>
              <h3 className={styles.cardTitle}>Top Listener</h3>
              <span className={styles.chev}>›</span>
            </div>
            <p className={styles.miniLabel}>Ranked by plays</p>
            <div className={styles.bigNumberBlue}>{topListeners[0]?.label || "—"}</div>
            <div className={styles.sessionDate}>
              {compactNumber(topListeners[0]?.count || 0)} plays
            </div>
          </button>
        </div>
      </section>

      {/* GLOBAL LOCATION STATS */}
      <section className={`${styles.card} ${styles.fullCard}`}>
        <div className={styles.cardHeaderMini}>
          <h3 className={styles.cardTitle}>Global Locations</h3>
          <span className={styles.chev}>›</span>
        </div>

        <div className={styles.locationGrid}>
          <button className={styles.locationCell} onClick={() => setActiveTab("global")}>
            <span className={styles.locationLabel}>Top City</span>
            <strong>{topGlobalCity?.label || "—"}</strong>
            <span>{compactNumber(topGlobalCity?.count || 0)} plays</span>
          </button>

          <button className={styles.locationCell} onClick={() => setActiveTab("global")}>
            <span className={styles.locationLabel}>Top State</span>
            <strong>{topGlobalRegion?.label || "—"}</strong>
            <span>{compactNumber(topGlobalRegion?.count || 0)} plays</span>
          </button>

          <button className={styles.locationCell} onClick={() => setActiveTab("global")}>
            <span className={styles.locationLabel}>Top Country</span>
            <strong>{topGlobalCountry?.label || "—"}</strong>
            <span>{compactNumber(topGlobalCountry?.count || 0)} plays</span>
          </button>

          <button className={styles.locationCell} onClick={() => setActiveTab("user")}>
            <span className={styles.locationLabel}>{username ? `${username}'s Top City` : "Your Top City"}</span>
            <strong>{topUserCity?.label || "—"}</strong>
            <span>{compactNumber(topUserCity?.count || 0)} plays</span>
          </button>
        </div>
      </section>

      <section className={styles.bottomPanel}>
        <div className={styles.bottomContent}>
          {activeTab === "user" && (
            <>
              <div className={styles.bottomKicker}>{username ? `${username}'s Listening Summary` : "Your Listening Summary"}</div>
              <div className={styles.bottomTitle}>Your habits, favorites, apps, and places</div>
              <div className={styles.bottomSub}>
                Everything personal is grouped together here so your listening behavior is easier to understand at a glance.
              </div>

              <div className={styles.summaryStack}>
                <div className={styles.summarySection}>
                  <div className={styles.summarySectionTitle}>{username ? `${username}'s Listening` : "Your Listening"}</div>
                  <div className={styles.listStack}>
                    <div className={styles.listRow}>
                      <div className={styles.listRowText}>
                        <strong>Total Plays</strong>
                        <span>Personal activity</span>
                      </div>
                      <div className={styles.listRowValue}>{compactNumber(totals.totalUserPlays)}</div>
                    </div>

                    <div className={styles.listRow}>
                      <div className={styles.listRowText}>
                        <strong>Top Song</strong>
                        <span>Most played song</span>
                      </div>
                      <div className={styles.listRowValue}>{topUserSong?.title || "—"}</div>
                    </div>

                    <div className={styles.listRow}>
                      <div className={styles.listRowText}>
                        <strong>Top App</strong>
                        <span>Most played project</span>
                      </div>
                      <div className={styles.listRowValue}>{topUserApp?.label || "—"}</div>
                    </div>
                  </div>
                </div>

                <div className={styles.summarySection}>
                  <div className={styles.summarySectionTitle}>{username ? `${username}'s Favorites` : "Your Favorites"}</div>
                  <div className={styles.listStack}>
                    <div className={styles.listRow}>
                      <div className={styles.listRowText}>
                        <strong>Total Favorites</strong>
                        <span>Saved songs</span>
                      </div>
                      <div className={styles.listRowValue}>{compactNumber(totals.totalFavoriteSongs)}</div>
                    </div>

                    <div className={styles.listRow}>
                      <div className={styles.listRowText}>
                        <strong>Latest Favorite</strong>
                        <span>Most recently saved</span>
                      </div>
                      <div className={styles.listRowValue}>{latestFavorite?.title || "—"}</div>
                    </div>
                  </div>
                </div>

                <div className={styles.summarySection}>
                  <div className={styles.summarySectionTitle}>{username ? `${username}'s Places` : "Your Places"}</div>
                  <div className={styles.listStack}>
                    {userTopCities.slice(0, 3).map((row) => (
                      <div key={row.label} className={styles.listRow}>
                        <div className={styles.listRowText}>
                          <strong>{row.label}</strong>
                          <span>City plays</span>
                        </div>
                        <div className={styles.listRowValue}>{compactNumber(row.count)}</div>
                      </div>
                    ))}
                    {userTopCities.length === 0 ? (
                      <div className={styles.listRow}>
                        <div className={styles.listRowText}>
                          <strong>No place data yet</strong>
                          <span>Start listening to build local habits</span>
                        </div>
                        <div className={styles.listRowValue}>—</div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === "global" && (
            <>
              <div className={styles.bottomKicker}>Global Summary</div>
              <div className={styles.bottomTitle}>Songs, listeners, apps, and places</div>
              <div className={styles.bottomSub}>
                This is the global side of the picture, including top listeners, top apps, and the places where the most listening activity is happening.
              </div>

              <div className={styles.summaryStack}>
                <div className={styles.summarySection}>
                  <div className={styles.summarySectionTitle}>Global Song Stats</div>
                  <div className={styles.listStack}>
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
                        <div className={styles.listRowValue}>{compactNumber(song.playCount || 0)}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className={styles.summarySection}>
                  <div className={styles.summarySectionTitle}>Top Listeners</div>
                  <div className={styles.listStack}>
                    {topListeners.slice(0, 5).map((row, index) => (
                      <div key={`${row.label}-${index}`} className={styles.listRow}>
                        <div className={styles.listRowText}>
                          <strong>{index + 1}. {row.label}</strong>
                          <span>Listener rank</span>
                        </div>
                        <div className={styles.listRowValue}>{compactNumber(row.count)}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className={styles.summarySection}>
                  <div className={styles.summarySectionTitle}>Global App Stats</div>
                  <div className={styles.listStack}>
                    {globalAppRows.slice(0, 5).map((row) => (
                      <div key={row.label} className={styles.listRow}>
                        <div className={styles.listRowText}>
                          <strong>{row.label}</strong>
                          <span>Project plays</span>
                        </div>
                        <div className={styles.listRowValue}>{compactNumber(row.count)}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className={styles.summarySection}>
                  <div className={styles.summarySectionTitle}>Global Places</div>
                  <div className={styles.rankingsGrid}>
                    {globalRankingRows.map((row) => (
                      <div key={row.label} className={styles.rankingCell}>
                        <div className={styles.rankingLabel}>{row.label}</div>
                        <div className={styles.rankingValue}>{row.value}</div>
                        <div className={styles.rankingMeta}>{row.meta}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <div className={styles.bottomTabs}>
          <button
            className={`${styles.bottomTab} ${activeTab === "user" ? styles.bottomTabActive : ""}`}
            onClick={() => setActiveTab("user")}
          >
            {username || "User"}
          </button>
          <button
            className={`${styles.bottomTab} ${activeTab === "global" ? styles.bottomTabActive : ""}`}
            onClick={() => setActiveTab("global")}
          >
            Global
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
