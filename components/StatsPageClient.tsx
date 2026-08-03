"use client";

import Image from "next/image";
import Link from "next/link";
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
};

type CountRow = { label: string; count: number };
type ListenerRow = { label: string; count: number };

type ShareStats = {
  myShares: number;
  globalShares: number;
  acceptedTransfers: number;
  projectShares: number;
  songShares: number;
  accountsFromShare: number;
  topSharers: CountRow[];
  mostSharedSongs: CountRow[];
  mostSharedProjects: CountRow[];
};

type Tab =
  | "summary"
  | "apps"
  | "places"
  | "share"
  | "rankings";

function compact(value: number) {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value || 0);
}

function headerDate() {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(new Date());
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, value));
}

function ListRows({
  rows,
  suffix = "plays",
}: {
  rows: CountRow[];
  suffix?: string;
}) {
  return (
    <div className={styles.listStack}>
      {rows.slice(0, 10).map((row, index) => (
        <div
          key={`${row.label}-${index}`}
          className={styles.listRow}
        >
          <div className={styles.listRowText}>
            <strong>
              {index + 1}. {row.label}
            </strong>
            <span>{suffix}</span>
          </div>
          <div className={styles.listRowValue}>
            {compact(row.count)}
          </div>
        </div>
      ))}
    </div>
  );
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
  shareStats,
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
  shareStats: ShareStats;
}) {
  const [mode, setMode] =
    useState<"user" | "global">("user");
  const [activeTab, setActiveTab] =
    useState<Tab>("summary");
  const [selectedSong, setSelectedSong] =
    useState<SongRow | null>(null);

  const totals = useMemo(
    () => ({
      userPlays: userSongs.reduce(
        (sum, row) => sum + Number(row.playCount || 0),
        0,
      ),
      globalPlays: globalSongs.reduce(
        (sum, row) => sum + Number(row.playCount || 0),
        0,
      ),
      favorites: favoriteSongs.length,
      reach: globalSongs.reduce(
        (sum, row) =>
          sum + Number(row.uniqueListenerCount || 0),
        0,
      ),
    }),
    [userSongs, globalSongs, favoriteSongs],
  );

  const currentSongs =
    mode === "user" ? userSongs : globalSongs;
  const currentApps =
    mode === "user" ? userAppRows : globalAppRows;
  const currentCities =
    mode === "user" ? userTopCities : globalTopCities;
  const currentRegions =
    mode === "user"
      ? userTopRegions
      : globalTopRegions;
  const currentCountries =
    mode === "user"
      ? userTopCountries
      : globalTopCountries;

  const ringListening = clamp(
    ((mode === "user"
      ? totals.userPlays
      : totals.globalPlays) /
      200) *
      100,
  );
  const ringFavorites = clamp(
    ((mode === "user"
      ? totals.favorites
      : shareStats.acceptedTransfers) /
      10) *
      100,
  );
  const ringReach = clamp(
    ((mode === "user"
      ? shareStats.myShares
      : totals.reach) /
      25) *
      100,
  );

  const tabs: Array<{ key: Tab; label: string }> = [
    { key: "summary", label: "Summary" },
    { key: "apps", label: "Apps" },
    { key: "places", label: "Places" },
    { key: "share", label: "Share" },
    { key: "rankings", label: "Rankings" },
  ];

  const topSong = currentSongs[0] || null;
  const topApp = currentApps[0] || null;
  const topCity = currentCities[0] || null;
  const latestFavorite = favoriteSongs[0] || null;

  return (
    <main className={styles.page}>
      <div className={styles.topChrome}>
        <Link
          href="/home"
          className={styles.backPill}
          aria-label="Back to Home"
        >
          <Image
            src="/apps/stats/back.png"
            alt=""
            width={22}
            height={22}
            className={styles.backImg}
          />
        </Link>

        <div className={styles.userChip}>
          @{username || "user"}
        </div>
      </div>

      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>
            {username
              ? `${username}'s Activity`
              : "Your Activity"}
          </h1>
          <p className={styles.date}>{headerDate()}</p>
        </div>
      </header>

      <section className={styles.modeSwitch}>
        <button
          className={`${styles.modeSwitchBtn} ${
            mode === "user"
              ? styles.modeSwitchBtnActive
              : ""
          }`}
          onClick={() => {
            setMode("user");
            setActiveTab("summary");
          }}
        >
          {username || "User"}
        </button>

        <button
          className={`${styles.modeSwitchBtn} ${
            mode === "global"
              ? styles.modeSwitchBtnActive
              : ""
          }`}
          onClick={() => {
            setMode("global");
            setActiveTab("summary");
          }}
        >
          Global
        </button>
      </section>

      <section className={`${styles.card} ${styles.ringsCard}`}>
        <div>
          <h2 className={styles.cardTitle}>
            {mode === "user"
              ? "Your Activity Rings"
              : "Global Activity Rings"}
          </h2>

          <div
            className={styles.rings}
            style={
              {
                "--listening": `${ringListening}%`,
                "--favorites": `${ringFavorites}%`,
                "--reach": `${ringReach}%`,
              } as React.CSSProperties
            }
          >
            <div
              className={`${styles.ring} ${styles.ringListening}`}
            />
            <div
              className={`${styles.ring} ${styles.ringFavorites}`}
            />
            <div
              className={`${styles.ring} ${styles.ringReach}`}
            />
            <div className={styles.ringsCenter} />
          </div>
        </div>

        <div className={styles.ringLegend}>
          <div className={styles.legendRow}>
            <span
              className={`${styles.legendDot} ${styles.listeningDot}`}
            />
            <div>
              <strong>Listening</strong>
              <span>
                {compact(
                  mode === "user"
                    ? totals.userPlays
                    : totals.globalPlays,
                )}{" "}
                plays
              </span>
            </div>
          </div>

          <div className={styles.legendRow}>
            <span
              className={`${styles.legendDot} ${styles.favoritesDot}`}
            />
            <div>
              <strong>
                {mode === "user"
                  ? "Favorites"
                  : "Accepted Shares"}
              </strong>
              <span>
                {compact(
                  mode === "user"
                    ? totals.favorites
                    : shareStats.acceptedTransfers,
                )}
              </span>
            </div>
          </div>

          <div className={styles.legendRow}>
            <span
              className={`${styles.legendDot} ${styles.reachDot}`}
            />
            <div>
              <strong>
                {mode === "user"
                  ? "Your Shares"
                  : "Global Reach"}
              </strong>
              <span>
                {compact(
                  mode === "user"
                    ? shareStats.myShares
                    : totals.reach,
                )}
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.twoColGrid}>
        <button
          className={`${styles.card} ${styles.tapCard}`}
          onClick={() => setActiveTab("summary")}
        >
          <span className={styles.miniLabel}>
            {mode === "user"
              ? "Your Plays"
              : "Global Plays"}
          </span>
          <strong className={styles.bigNumberPurple}>
            {compact(
              mode === "user"
                ? totals.userPlays
                : totals.globalPlays,
            )}
          </strong>
          <span className={styles.sessionDate}>
            Listening total
          </span>
        </button>

        <button
          className={`${styles.card} ${styles.tapCard}`}
          onClick={() => setActiveTab("share")}
        >
          <span className={styles.miniLabel}>
            {mode === "user"
              ? "Your Shares"
              : "Global Shares"}
          </span>
          <strong className={styles.bigNumberBlue}>
            {compact(
              mode === "user"
                ? shareStats.myShares
                : shareStats.globalShares,
            )}
          </strong>
          <span className={styles.sessionDate}>
            Nearby activity
          </span>
        </button>

        <button
          className={`${styles.card} ${styles.tapCard}`}
          onClick={() => topSong && setSelectedSong(topSong)}
        >
          <span className={styles.miniLabel}>Top Song</span>
          {topSong?.coverImageUrl ? (
            <img
              src={topSong.coverImageUrl}
              alt=""
              className={styles.sessionCover}
            />
          ) : (
            <div className={styles.sessionCoverFallback}>
              ♪
            </div>
          )}
          <strong className={styles.cardItemTitle}>
            {topSong?.title || "No listening yet"}
          </strong>
        </button>

        <button
          className={`${styles.card} ${styles.tapCard}`}
          onClick={() =>
            latestFavorite &&
            setSelectedSong(latestFavorite)
          }
        >
          <span className={styles.miniLabel}>
            Latest Favorite
          </span>
          {latestFavorite?.coverImageUrl ? (
            <img
              src={latestFavorite.coverImageUrl}
              alt=""
              className={styles.sessionCover}
            />
          ) : (
            <div className={styles.sessionCoverFallback}>
              ★
            </div>
          )}
          <strong className={styles.cardItemTitle}>
            {latestFavorite?.title || "No favorites yet"}
          </strong>
        </button>
      </section>

      <section className={`${styles.card} ${styles.fullCard}`}>
        <div className={styles.cardHeaderMini}>
          <h3 className={styles.cardTitle}>
            {mode === "user"
              ? `${username || "User"} Overview`
              : "Global Overview"}
          </h3>
        </div>

        <div className={styles.locationGrid}>
          <button
            className={styles.locationCell}
            onClick={() => setActiveTab("places")}
          >
            <span className={styles.locationLabel}>
              Top City
            </span>
            <strong>{topCity?.label || "—"}</strong>
            <span>{compact(topCity?.count || 0)} plays</span>
          </button>

          <button
            className={styles.locationCell}
            onClick={() => setActiveTab("apps")}
          >
            <span className={styles.locationLabel}>
              Top App
            </span>
            <strong>{topApp?.label || "—"}</strong>
            <span>{compact(topApp?.count || 0)} plays</span>
          </button>
        </div>
      </section>

      <nav
        className={styles.sectionTabs}
        aria-label="Stats sections"
      >
        {tabs.map((tab) => (
          <button
            key={tab.key}
            className={`${styles.sectionTab} ${
              activeTab === tab.key
                ? styles.sectionTabActive
                : ""
            }`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <section className={styles.bottomPanel}>
        <div className={styles.bottomContent}>
          {activeTab === "summary" ? (
            <>
              <div className={styles.bottomKicker}>
                {mode === "user"
                  ? "Your Summary"
                  : "Global Summary"}
              </div>
              <div className={styles.bottomTitle}>
                Listening activity
              </div>
              <div className={styles.listStack}>
                {currentSongs.slice(0, 10).map((song) => (
                  <button
                    key={song.songSlug}
                    className={styles.listRow}
                    onClick={() => setSelectedSong(song)}
                  >
                    <div className={styles.listRowText}>
                      <strong>{song.title}</strong>
                      <span>
                        {song.artistName} · {song.appSlug}
                      </span>
                    </div>
                    <div className={styles.listRowValue}>
                      {compact(song.playCount || 0)}
                    </div>
                  </button>
                ))}
              </div>
            </>
          ) : null}

          {activeTab === "apps" ? (
            <>
              <div className={styles.bottomKicker}>
                App Stats
              </div>
              <ListRows
                rows={currentApps}
                suffix="app plays"
              />
            </>
          ) : null}

          {activeTab === "places" ? (
            <>
              <div className={styles.bottomKicker}>
                Places
              </div>
              <div className={styles.summaryStack}>
                <div>
                  <div className={styles.summarySectionTitle}>
                    Cities
                  </div>
                  <ListRows rows={currentCities} />
                </div>
                <div>
                  <div className={styles.summarySectionTitle}>
                    States
                  </div>
                  <ListRows rows={currentRegions} />
                </div>
                <div>
                  <div className={styles.summarySectionTitle}>
                    Countries
                  </div>
                  <ListRows rows={currentCountries} />
                </div>
              </div>
            </>
          ) : null}

          {activeTab === "share" ? (
            <>
              <div className={styles.bottomKicker}>
                Share Stats
              </div>
              <div className={styles.rankingsGrid}>
                {[
                  ["Your Shares", shareStats.myShares],
                  ["Global Shares", shareStats.globalShares],
                  [
                    "Accepted",
                    shareStats.acceptedTransfers,
                  ],
                  [
                    "Accounts",
                    shareStats.accountsFromShare,
                  ],
                ].map(([label, value]) => (
                  <div
                    className={styles.rankingCell}
                    key={String(label)}
                  >
                    <div className={styles.rankingLabel}>
                      {label}
                    </div>
                    <div className={styles.rankingValue}>
                      {compact(Number(value))}
                    </div>
                  </div>
                ))}
              </div>

              <div className={styles.summaryStack}>
                <div>
                  <div className={styles.summarySectionTitle}>
                    Top Sharers
                  </div>
                  <ListRows
                    rows={shareStats.topSharers}
                    suffix="shares"
                  />
                </div>
                <div>
                  <div className={styles.summarySectionTitle}>
                    Most Shared Songs
                  </div>
                  <ListRows
                    rows={shareStats.mostSharedSongs}
                    suffix="shares"
                  />
                </div>
              </div>
            </>
          ) : null}

          {activeTab === "rankings" ? (
            <>
              <div className={styles.bottomKicker}>
                Rankings
              </div>
              <div className={styles.summaryStack}>
                <div>
                  <div className={styles.summarySectionTitle}>
                    Top Listeners
                  </div>
                  <ListRows
                    rows={topListeners}
                    suffix="plays"
                  />
                </div>
                <div>
                  <div className={styles.summarySectionTitle}>
                    Top Songs
                  </div>
                  <ListRows
                    rows={globalSongs.map((song) => ({
                      label: song.title,
                      count: Number(song.playCount || 0),
                    }))}
                  />
                </div>
              </div>
            </>
          ) : null}
        </div>
      </section>

      {selectedSong ? (
        <div
          className={styles.modalOverlay}
          onClick={() => setSelectedSong(null)}
        >
          <section
            className={styles.modalCard}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className={styles.modalClose}
              onClick={() => setSelectedSong(null)}
              aria-label="Close"
            >
              ×
            </button>

            <div className={styles.modalBody}>
              <div className={styles.modalMedia}>
                {selectedSong.coverImageUrl ? (
                  <img
                    src={selectedSong.coverImageUrl}
                    alt=""
                    className={styles.modalImg}
                  />
                ) : (
                  <div className={styles.modalFallback}>
                    ♪
                  </div>
                )}
              </div>

              <div>
                <div className={styles.bottomKicker}>
                  Song Activity
                </div>
                <h2 className={styles.modalTitle}>
                  {selectedSong.title}
                </h2>
                <p className={styles.modalSub}>
                  {selectedSong.artistName}
                </p>
                <p className={styles.modalMeta}>
                  {compact(selectedSong.playCount || 0)} plays
                  · {selectedSong.appSlug}
                </p>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
