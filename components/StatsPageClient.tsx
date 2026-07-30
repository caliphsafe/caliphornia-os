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

type CountRow = { label: string; count: number };
type ListenerRow = { label: string; count: number };

export type ShareStatsPayload = {
  mySharesCreated: number;
  myProjectShares: number;
  mySongShares: number;
  globalSharesCreated: number;
  globalAcceptedShares: number;
  globalProjectShares: number;
  globalSongShares: number;
  accountsFromShare: number;
  topSharers: ListenerRow[];
  mostSharedSongs: ListenerRow[];
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
  return {
    listening: clampPercent((totalUserPlays / 200) * 100),
    favorites: clampPercent((totalFavoriteSongs / 10) * 100),
    reach: clampPercent((totalGlobalReach / 25) * 100),
  };
}

type TopCardProps = {
  title: string;
  subtitle: string;
  value: string;
  tone: "purple" | "blue" | "green";
  onClick?: () => void;
  coverImageUrl?: string | null;
  fallback?: string;
  footer?: string;
};

function TopCard({
  title,
  subtitle,
  value,
  tone,
  onClick,
  coverImageUrl,
  fallback = "♪",
  footer,
}: TopCardProps) {
  const valueClass =
    tone === "purple"
      ? styles.bigNumberPurple
      : tone === "blue"
        ? styles.bigNumberBlue
        : styles.bigNumberGreen;

  return (
    <button className={`${styles.card} ${styles.tapCard}`} onClick={onClick}>
      <div className={styles.cardHeaderMini}>
        <h3 className={styles.cardTitle}>{title}</h3>
        <span className={styles.chev}>›</span>
      </div>
      <p className={styles.miniLabel}>{subtitle}</p>
      {coverImageUrl ? (
        <img src={coverImageUrl} alt={title} className={styles.sessionCover} />
      ) : fallback ? (
        <div className={styles.sessionCoverFallback}>{fallback}</div>
      ) : null}
      <div className={valueClass}>{value}</div>
      {footer ? <div className={styles.sessionDate}>{footer}</div> : null}
    </button>
  );
}

function ListRows({ rows, empty, label }: { rows: CountRow[]; empty: string; label: string }) {
  if (!rows.length) {
    return <div className={styles.listRow}><div className={styles.listRowText}><strong>{empty}</strong><span>{label}</span></div><div className={styles.listRowValue}>0</div></div>;
  }
  return (
    <>
      {rows.slice(0, 10).map((row, index) => (
        <div key={`${row.label}-${index}`} className={styles.listRow}>
          <div className={styles.listRowText}>
            <strong>{index + 1}. {row.label}</strong>
            <span>{label}</span>
          </div>
          <div className={styles.listRowValue}>{compactNumber(row.count)}</div>
        </div>
      ))}
    </>
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
  sharingStats,
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
  sharingStats: ShareStatsPayload;
}) {
  const [mode, setMode] = useState<"user" | "global">("user");
  const [activeTab, setActiveTab] = useState<"summary" | "apps" | "places" | "rankings" | "sharing">("summary");
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
  const topListener = topListeners[0] || null;
  const topSharer = sharingStats.topSharers[0] || null;
  const mostSharedSong = sharingStats.mostSharedSongs[0] || null;

  const currentTopSong = mode === "user" ? topUserSong : topGlobalSong;
  const currentTopApp = mode === "user" ? topUserApp : topGlobalApp;
  const currentTopCity = mode === "user" ? topUserCity : topGlobalCity;
  const currentTopRegion = mode === "user" ? topUserRegion : topGlobalRegion;
  const currentTopCountry = mode === "user" ? topUserCountry : topGlobalCountry;
  const currentAppRows = mode === "user" ? userAppRows : globalAppRows;
  const currentCityRows = mode === "user" ? userTopCities : globalTopCities;
  const currentRegionRows = mode === "user" ? userTopRegions : globalTopRegions;
  const currentCountryRows = mode === "user" ? userTopCountries : globalTopCountries;

  const currentRankingRows = mode === "user" ? [
    { label: "Top Song", value: topUserSong?.title || "—", meta: topUserSong ? `${compactNumber(topUserSong.playCount || 0)} plays` : "No data yet" },
    { label: "Top App", value: topUserApp?.label || "—", meta: topUserApp ? `${compactNumber(topUserApp.count || 0)} plays` : "No data yet" },
    { label: "Top City", value: topUserCity?.label || "—", meta: topUserCity ? `${compactNumber(topUserCity.count || 0)} plays` : "No data yet" },
    { label: "Top Country", value: topUserCountry?.label || "—", meta: topUserCountry ? `${compactNumber(topUserCountry.count || 0)} plays` : "No data yet" },
  ] : [
    { label: "Top Song", value: topGlobalSong?.title || "—", meta: topGlobalSong ? `${compactNumber(topGlobalSong.playCount || 0)} plays` : "No data yet" },
    { label: "Top App", value: topGlobalApp?.label || "—", meta: topGlobalApp ? `${compactNumber(topGlobalApp.count || 0)} plays` : "No data yet" },
    { label: "Top City", value: topGlobalCity?.label || "—", meta: topGlobalCity ? `${compactNumber(topGlobalCity.count || 0)} plays` : "No data yet" },
    { label: "Top Country", value: topGlobalCountry?.label || "—", meta: topGlobalCountry ? `${compactNumber(topGlobalCountry.count || 0)} plays` : "No data yet" },
  ];

  return (
    <main className={styles.page}>
      <div className={styles.topChrome}>
        <Link href="/home" className={styles.backPill} aria-label="Back to Home">
          <Image src="/apps/stats/back.png" alt="Back" width={22} height={22} className={styles.backImg} />
        </Link>
        <div className={styles.userChip} title={username ? `@${username}` : "@user"}>@{username || "user"}</div>
      </div>

      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>{username ? `${username}'s Listening Summary` : "Your Listening Summary"}</h1>
          <p className={styles.date}>{formatHeaderDate()}</p>
        </div>
      </div>

      <section className={styles.modeSwitch}>
        <button className={`${styles.modeSwitchBtn} ${mode === "user" ? styles.modeSwitchBtnActive : ""}`} onClick={() => { setMode("user"); setActiveTab("summary"); }}>
          {username || "User"}
        </button>
        <button className={`${styles.modeSwitchBtn} ${mode === "global" ? styles.modeSwitchBtnActive : ""}`} onClick={() => { setMode("global"); setActiveTab("summary"); }}>
          Global
        </button>
      </section>

      <section className={`${styles.card} ${styles.ringsCard}`}>
        <div>
          <h2 className={styles.cardTitle}>{mode === "user" ? "Your Listening Rings" : "Global Listening Rings"}</h2>
          <div className={styles.rings} style={{ ["--listening" as any]: `${ringPercents.listening}%`, ["--favorites" as any]: `${ringPercents.favorites}%`, ["--reach" as any]: `${ringPercents.reach}%` }}>
            <div className={`${styles.ring} ${styles.ringListening}`} />
            <div className={`${styles.ring} ${styles.ringFavorites}`} />
            <div className={`${styles.ring} ${styles.ringReach}`} />
            <div className={styles.ringsCenter} />
          </div>
        </div>
        <div className={styles.ringLegend}>
          {mode === "user" ? (
            <>
              <div className={styles.legendRow}><span className={`${styles.legendDot} ${styles.listeningDot}`} /><div><strong>{username ? `${username}'s Listening` : "Your Listening"}</strong><span>{compactNumber(totals.totalUserPlays)} total plays</span></div></div>
              <div className={styles.legendRow}><span className={`${styles.legendDot} ${styles.favoritesDot}`} /><div><strong>{username ? `${username}'s Favorites` : "Your Favorites"}</strong><span>{compactNumber(totals.totalFavoriteSongs)} songs saved</span></div></div>
              <div className={styles.legendRow}><span className={`${styles.legendDot} ${styles.reachDot}`} /><div><strong>Your Shares</strong><span>{compactNumber(sharingStats.mySharesCreated)} shares started</span></div></div>
            </>
          ) : (
            <>
              <div className={styles.legendRow}><span className={`${styles.legendDot} ${styles.listeningDot}`} /><div><strong>Global Plays</strong><span>{compactNumber(totals.totalGlobalPlays)} total plays</span></div></div>
              <div className={styles.legendRow}><span className={`${styles.legendDot} ${styles.favoritesDot}`} /><div><strong>Global Reach</strong><span>{compactNumber(totals.totalGlobalReach)} listeners reached</span></div></div>
              <div className={styles.legendRow}><span className={`${styles.legendDot} ${styles.reachDot}`} /><div><strong>Global Shares</strong><span>{compactNumber(sharingStats.globalSharesCreated)} shares started</span></div></div>
            </>
          )}
        </div>
      </section>

      <section className={styles.twoColGrid}>
        {mode === "user" ? (
          <>
            <TopCard title="Your Plays" subtitle="Personal activity" value={compactNumber(totals.totalUserPlays)} tone="purple" footer="Listening total" onClick={() => setActiveTab("summary")} />
            <TopCard title="Your Top Song" subtitle="Most played" value={compactNumber(topUserSong?.playCount || 0)} tone="green" coverImageUrl={topUserSong?.coverImageUrl || null} footer={topUserSong?.title || "No listening yet"} onClick={() => topUserSong && setSelectedSong(topUserSong)} />
            <TopCard title="Your Shares" subtitle="Share activity" value={compactNumber(sharingStats.mySharesCreated)} tone="blue" fallback="⌁" footer={`${sharingStats.myProjectShares} project shares`} onClick={() => setActiveTab("sharing")} />
            <TopCard title="Your Top App" subtitle="Most played project" value={currentTopApp?.label || "—"} tone="blue" footer={`${compactNumber(currentTopApp?.count || 0)} plays`} fallback="" onClick={() => setActiveTab("apps")} />
          </>
        ) : (
          <>
            <TopCard title="Global Plays" subtitle="Overall activity" value={compactNumber(totals.totalGlobalPlays)} tone="blue" footer="All song plays" onClick={() => setActiveTab("summary")} />
            <TopCard title="Most Shared Song" subtitle="Share leader" value={compactNumber(mostSharedSong?.count || 0)} tone="green" fallback="⌁" footer={mostSharedSong?.label || "No shares yet"} onClick={() => setActiveTab("sharing")} />
            <TopCard title="Top Sharer" subtitle="Share rank" value={topSharer?.label || "—"} tone="blue" footer={`${compactNumber(topSharer?.count || 0)} shares`} fallback="" onClick={() => setActiveTab("sharing")} />
            <TopCard title="Accounts from Share" subtitle="Guest claims" value={compactNumber(sharingStats.accountsFromShare)} tone="purple" fallback="+" footer="New accounts" onClick={() => setActiveTab("sharing")} />
          </>
        )}
      </section>

      <section className={`${styles.card} ${styles.fullCard}`}>
        <div className={styles.cardHeaderMini}>
          <h3 className={styles.cardTitle}>{mode === "user" ? `${username || "User"} Overview` : "Global Overview"}</h3>
          <span className={styles.chev}>›</span>
        </div>
        <div className={styles.locationGrid}>
          <button className={styles.locationCell} onClick={() => setActiveTab("places")}><span className={styles.locationLabel}>Top City</span><strong>{currentTopCity?.label || "—"}</strong><span>{compactNumber(currentTopCity?.count || 0)} plays</span></button>
          <button className={styles.locationCell} onClick={() => setActiveTab("places")}><span className={styles.locationLabel}>Top State</span><strong>{currentTopRegion?.label || "—"}</strong><span>{compactNumber(currentTopRegion?.count || 0)} plays</span></button>
          <button className={styles.locationCell} onClick={() => setActiveTab("apps")}><span className={styles.locationLabel}>Top App</span><strong>{currentTopApp?.label || "—"}</strong><span>{compactNumber(currentTopApp?.count || 0)} plays</span></button>
          <button className={styles.locationCell} onClick={() => setActiveTab("sharing")}><span className={styles.locationLabel}>Share</span><strong>{mode === "user" ? sharingStats.mySharesCreated : sharingStats.globalSharesCreated}</strong><span>{mode === "user" ? "Your shares" : "Global shares"}</span></button>
        </div>
      </section>

      <section className={styles.bottomPanel}>
        <div className={styles.bottomContent}>
          {activeTab === "summary" && (
            <>
              <div className={styles.bottomKicker}>{mode === "user" ? `${username || "User"} Summary` : "Global Summary"}</div>
              <div className={styles.bottomTitle}>{mode === "user" ? "Your listening, favorites, apps, places, and shares" : "Songs, listeners, apps, locations, and sharing"}</div>
              <div className={styles.bottomSub}>{mode === "user" ? "Your OS activity is grouped together here so your habits make sense in one place." : "This is the broader picture of what is happening across Caliphornia OS."}</div>
              <div className={styles.summaryStack}>
                <div className={styles.summarySection}>
                  <div className={styles.summarySectionTitle}>{mode === "user" ? "Listening" : "Songs"}</div>
                  <div className={styles.listStack}>{(mode === "user" ? userSongs : globalSongs).slice(0, 5).map((song) => (<button key={song.songSlug} className={styles.listRow} onClick={() => setSelectedSong(song)}><div className={styles.listRowText}><strong>{song.title}</strong><span>{song.appSlug || "Unknown app"}</span></div><div className={styles.listRowValue}>{compactNumber(song.playCount || 0)}</div></button>))}</div>
                </div>
                <div className={styles.summarySection}>
                  <div className={styles.summarySectionTitle}>{mode === "user" ? "Favorites" : "Top Listeners"}</div>
                  <div className={styles.listStack}>{mode === "user" ? favoriteSongs.slice(0, 5).map((song) => (<button key={song.songSlug} className={styles.listRow} onClick={() => setSelectedSong(song)}><div className={styles.listRowText}><strong>{song.title}</strong><span>{song.appSlug || "Unknown app"}</span></div><div className={styles.listRowValue}>{formatShortDate(song.favoritedAt)}</div></button>)) : topListeners.slice(0, 5).map((row, index) => (<div key={`${row.label}-${index}`} className={styles.listRow}><div className={styles.listRowText}><strong>{index + 1}. {row.label}</strong><span>Listener rank</span></div><div className={styles.listRowValue}>{compactNumber(row.count)}</div></div>))}</div>
                </div>
              </div>
            </>
          )}

          {activeTab === "apps" && (<><div className={styles.bottomKicker}>{mode === "user" ? `${username || "User"} App Stats` : "Global App Stats"}</div><div className={styles.summaryStack}><div className={styles.summarySection}><div className={styles.summarySectionTitle}>Top Apps</div><div className={styles.listStack}><ListRows rows={currentAppRows} empty="No app data yet" label={mode === "user" ? "Your project plays" : "Global project plays"} /></div></div></div></>)}

          {activeTab === "places" && (<><div className={styles.bottomKicker}>{mode === "user" ? `${username || "User"} Places` : "Global Places"}</div><div className={styles.summaryStack}><div className={styles.summarySection}><div className={styles.summarySectionTitle}>Top Cities</div><div className={styles.listStack}><ListRows rows={currentCityRows} empty="No city data yet" label="City plays" /></div></div><div className={styles.summarySection}><div className={styles.summarySectionTitle}>Top States</div><div className={styles.listStack}><ListRows rows={currentRegionRows} empty="No state data yet" label="State plays" /></div></div><div className={styles.summarySection}><div className={styles.summarySectionTitle}>Top Countries</div><div className={styles.listStack}><ListRows rows={currentCountryRows} empty="No country data yet" label="Country plays" /></div></div></div></>)}

          {activeTab === "rankings" && (<><div className={styles.bottomKicker}>{mode === "user" ? `${username || "User"} Rankings` : "Global Rankings"}</div><div className={styles.summaryStack}><div className={styles.summarySection}><div className={styles.summarySectionTitle}>Key Rankings</div><div className={styles.rankingsGrid}>{currentRankingRows.map((row) => (<div key={row.label} className={styles.rankingCell}><div className={styles.rankingLabel}>{row.label}</div><div className={styles.rankingValue}>{row.value}</div><div className={styles.rankingMeta}>{row.meta}</div></div>))}</div></div>{mode === "global" ? (<div className={styles.summarySection}><div className={styles.summarySectionTitle}>Top Listeners</div><div className={styles.listStack}><ListRows rows={topListeners} empty="No listener rank yet" label="Ranked by total plays" /></div></div>) : null}</div></>)}

          {activeTab === "sharing" && (
            <>
              <div className={styles.bottomKicker}>{mode === "user" ? `${username || "User"} Sharing` : "Global Sharing"}</div>
              <div className={styles.bottomTitle}>{mode === "user" ? "Your Share impact" : "How music is moving person-to-person"}</div>
              <div className={styles.bottomSub}>Share tracks proximity transfers, accepted guest listens, project shares, top sharers, and the songs people pass to each other most.</div>
              <div className={styles.summaryStack}>
                <div className={styles.summarySection}>
                  <div className={styles.summarySectionTitle}>Share Totals</div>
                  <div className={styles.rankingsGrid}>
                    <div className={styles.rankingCell}><div className={styles.rankingLabel}>Your shares</div><div className={styles.rankingValue}>{compactNumber(sharingStats.mySharesCreated)}</div><div className={styles.rankingMeta}>{sharingStats.mySongShares} song · {sharingStats.myProjectShares} project</div></div>
                    <div className={styles.rankingCell}><div className={styles.rankingLabel}>Global shares</div><div className={styles.rankingValue}>{compactNumber(sharingStats.globalSharesCreated)}</div><div className={styles.rankingMeta}>{sharingStats.globalSongShares} song · {sharingStats.globalProjectShares} project</div></div>
                    <div className={styles.rankingCell}><div className={styles.rankingLabel}>Accepted</div><div className={styles.rankingValue}>{compactNumber(sharingStats.globalAcceptedShares)}</div><div className={styles.rankingMeta}>Transfers accepted</div></div>
                    <div className={styles.rankingCell}><div className={styles.rankingLabel}>Accounts</div><div className={styles.rankingValue}>{compactNumber(sharingStats.accountsFromShare)}</div><div className={styles.rankingMeta}>Created from Share</div></div>
                  </div>
                </div>
                <div className={styles.summarySection}>
                  <div className={styles.summarySectionTitle}>Top Sharers</div>
                  <div className={styles.listStack}><ListRows rows={sharingStats.topSharers} empty="No sharers yet" label="Shares started" /></div>
                </div>
                <div className={styles.summarySection}>
                  <div className={styles.summarySectionTitle}>Most Shared Songs</div>
                  <div className={styles.listStack}><ListRows rows={sharingStats.mostSharedSongs} empty="No shared songs yet" label="Shares" /></div>
                </div>
                <Link href="/apps/share" className={styles.listRow}>
                  <div className={styles.listRowText}><strong>Open Share</strong><span>Start a proximity song or project handoff</span></div>
                  <div className={styles.listRowValue}>⌁</div>
                </Link>
              </div>
            </>
          )}
        </div>

        <div className={styles.bottomTabs}>
          <button className={`${styles.bottomTab} ${activeTab === "summary" ? styles.bottomTabActive : ""}`} onClick={() => setActiveTab("summary")}>Summary</button>
          <button className={`${styles.bottomTab} ${activeTab === "apps" ? styles.bottomTabActive : ""}`} onClick={() => setActiveTab("apps")}>Apps</button>
          <button className={`${styles.bottomTab} ${activeTab === "places" ? styles.bottomTabActive : ""}`} onClick={() => setActiveTab("places")}>Places</button>
          <button className={`${styles.bottomTab} ${activeTab === "sharing" ? styles.bottomTabActive : ""}`} onClick={() => setActiveTab("sharing")}>Share</button>
          <button className={`${styles.bottomTab} ${activeTab === "rankings" ? styles.bottomTabActive : ""}`} onClick={() => setActiveTab("rankings")}>Rankings</button>
        </div>
      </section>

      {selectedSong ? (
        <div className={styles.modalOverlay} onClick={() => setSelectedSong(null)}>
          <div className={styles.modalCard} onClick={(event) => event.stopPropagation()}>
            <button className={styles.modalClose} onClick={() => setSelectedSong(null)}>×</button>
            <div className={styles.modalBody}>
              <div className={styles.modalMedia}>{selectedSong.coverImageUrl ? <img src={selectedSong.coverImageUrl} alt={selectedSong.title} className={styles.modalImg} /> : <div className={styles.modalFallback}>♪</div>}</div>
              <div className={styles.modalCopy}>
                <h3>{selectedSong.title}</h3>
                <p>{selectedSong.artistName || "Unknown artist"}</p>
                <div className={styles.modalStats}>
                  <div><span>App</span><strong>{selectedSong.appSlug || "—"}</strong></div>
                  <div><span>Duration</span><strong>{selectedSong.durationLabel || "—"}</strong></div>
                  <div><span>Your Plays</span><strong>{compactNumber(selectedSong.userPlayCount || selectedSong.playCount || 0)}</strong></div>
                  <div><span>Global Reach</span><strong>{compactNumber(selectedSong.uniqueListenerCount || selectedSong.globalPlayCount || 0)}</strong></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
