"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import styles from "@/app/apps/stats/stats.module.css";

type SongRow = {
  songSlug: string;
  title: string;
  artistName: string;
  appSlug: string;
  playCount?: number;
  uniqueListenerCount?: number;
};

type CountRow = {
  label: string;
  count: number;
};

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

type Props = {
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
  topListeners: CountRow[];
  shareStats: ShareStats;
};

type Tab =
  | "summary"
  | "apps"
  | "places"
  | "share"
  | "rankings";

function compact(value = 0) {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function RankedList({
  rows,
  empty = "No activity yet.",
}: {
  rows: CountRow[];
  empty?: string;
}) {
  if (!rows.length) {
    return <div className={styles.empty}>{empty}</div>;
  }

  return (
    <div className={styles.list}>
      {rows.slice(0, 10).map((row, index) => (
        <article key={`${row.label}-${index}`}>
          <span>{index + 1}</span>
          <strong>{row.label}</strong>
          <b>{compact(row.count)}</b>
        </article>
      ))}
    </div>
  );
}

export default function StatsPageClient(props: Props) {
  const [mode, setMode] =
    useState<"user" | "global">("user");
  const [activeTab, setActiveTab] =
    useState<Tab>("summary");

  const songs =
    mode === "user" ? props.userSongs : props.globalSongs;
  const apps =
    mode === "user"
      ? props.userAppRows
      : props.globalAppRows;
  const cities =
    mode === "user"
      ? props.userTopCities
      : props.globalTopCities;
  const regions =
    mode === "user"
      ? props.userTopRegions
      : props.globalTopRegions;
  const countries =
    mode === "user"
      ? props.userTopCountries
      : props.globalTopCountries;

  const totals = useMemo(
    () => ({
      plays: songs.reduce(
        (sum, song) => sum + Number(song.playCount || 0),
        0,
      ),
      favorites: props.favoriteSongs.length,
      shares:
        mode === "user"
          ? props.shareStats.myShares
          : props.shareStats.globalShares,
    }),
    [
      songs,
      props.favoriteSongs.length,
      props.shareStats,
      mode,
    ],
  );

  const tabs: Array<{ key: Tab; label: string }> = [
    { key: "summary", label: "Summary" },
    { key: "apps", label: "Apps" },
    { key: "places", label: "Places" },
    { key: "share", label: "Share" },
    { key: "rankings", label: "Rankings" },
  ];

  return (
    <main className={styles.page}>
      <section className={styles.shell}>
        <header className={styles.topbar}>
          <Link href="/home">‹ Home</Link>
          <span>@{props.username || "user"}</span>
        </header>

        <section className={styles.hero}>
          <p>Caliphornia OS</p>
          <h1>Stats</h1>
          <span>
            Listening, apps, places, sharing, and rankings.
          </span>
        </section>

        <section className={styles.modeSwitch}>
          <button
            className={
              mode === "user" ? styles.active : ""
            }
            onClick={() => {
              setMode("user");
              setActiveTab("summary");
            }}
          >
            {props.username || "You"}
          </button>
          <button
            className={
              mode === "global" ? styles.active : ""
            }
            onClick={() => {
              setMode("global");
              setActiveTab("summary");
            }}
          >
            Global
          </button>
        </section>

        <nav
          className={styles.sectionNav}
          aria-label="Stats sections"
        >
          {tabs.map((tab) => (
            <button
              key={tab.key}
              className={
                activeTab === tab.key ? styles.active : ""
              }
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <section className={styles.metrics}>
          <article>
            <span>Plays</span>
            <strong>{compact(totals.plays)}</strong>
          </article>
          <article>
            <span>Favorites</span>
            <strong>{compact(totals.favorites)}</strong>
          </article>
          <article>
            <span>Shares</span>
            <strong>{compact(totals.shares)}</strong>
          </article>
        </section>

        <section className={styles.content}>
          {activeTab === "summary" ? (
            <>
              <div className={styles.heading}>
                <p>
                  {mode === "user"
                    ? "Your listening"
                    : "Global listening"}
                </p>
                <h2>Top songs</h2>
              </div>
              <RankedList
                rows={songs.map((song) => ({
                  label: `${song.title} — ${song.artistName}`,
                  count: Number(song.playCount || 0),
                }))}
              />
            </>
          ) : null}

          {activeTab === "apps" ? (
            <>
              <div className={styles.heading}>
                <p>App activity</p>
                <h2>Most used apps</h2>
              </div>
              <RankedList rows={apps} />
            </>
          ) : null}

          {activeTab === "places" ? (
            <>
              <div className={styles.heading}>
                <p>Listening geography</p>
                <h2>Places</h2>
              </div>
              <div className={styles.threeColumns}>
                <section>
                  <h3>Cities</h3>
                  <RankedList rows={cities} />
                </section>
                <section>
                  <h3>States</h3>
                  <RankedList rows={regions} />
                </section>
                <section>
                  <h3>Countries</h3>
                  <RankedList rows={countries} />
                </section>
              </div>
            </>
          ) : null}

          {activeTab === "share" ? (
            <>
              <div className={styles.heading}>
                <p>Sharing engine</p>
                <h2>Share Stats</h2>
              </div>

              <div className={styles.shareMetrics}>
                <article>
                  <span>Your Shares</span>
                  <strong>
                    {compact(props.shareStats.myShares)}
                  </strong>
                </article>
                <article>
                  <span>Global Shares</span>
                  <strong>
                    {compact(props.shareStats.globalShares)}
                  </strong>
                </article>
                <article>
                  <span>Accepted</span>
                  <strong>
                    {compact(
                      props.shareStats.acceptedTransfers,
                    )}
                  </strong>
                </article>
                <article>
                  <span>New Accounts</span>
                  <strong>
                    {compact(
                      props.shareStats.accountsFromShare,
                    )}
                  </strong>
                </article>
              </div>

              <div className={styles.threeColumns}>
                <section>
                  <h3>Top Sharers</h3>
                  <RankedList
                    rows={props.shareStats.topSharers}
                  />
                </section>
                <section>
                  <h3>Most Shared Songs</h3>
                  <RankedList
                    rows={
                      props.shareStats.mostSharedSongs
                    }
                  />
                </section>
                <section>
                  <h3>Most Shared Projects</h3>
                  <RankedList
                    rows={
                      props.shareStats.mostSharedProjects
                    }
                  />
                </section>
              </div>
            </>
          ) : null}

          {activeTab === "rankings" ? (
            <>
              <div className={styles.heading}>
                <p>Community standings</p>
                <h2>Rankings</h2>
              </div>

              <div className={styles.threeColumns}>
                <section>
                  <h3>Top Listeners</h3>
                  <RankedList rows={props.topListeners} />
                </section>
                <section>
                  <h3>Top Songs</h3>
                  <RankedList
                    rows={props.globalSongs.map((song) => ({
                      label: song.title,
                      count: Number(song.playCount || 0),
                    }))}
                  />
                </section>
                <section>
                  <h3>Top Apps</h3>
                  <RankedList rows={props.globalAppRows} />
                </section>
              </div>
            </>
          ) : null}
        </section>
      </section>
    </main>
  );
}
