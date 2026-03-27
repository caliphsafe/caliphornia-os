"use client";

import { useMemo, useState } from "react";

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

type LocationRow = {
  label: string;
  count: number;
};

type PlatformRow = {
  label: string;
  count: number;
};

type StatsClientProps = {
  username?: string;
  totals: {
    totalUserPlays: number;
    totalFavoriteSongs: number;
    totalGlobalPlays: number;
    totalGlobalReach: number;
  };
  globalSongs: SongRow[];
  userSongs: SongRow[];
  favoriteSongs: SongRow[];
  topCities: LocationRow[];
  topRegions: LocationRow[];
  topCountries: LocationRow[];
  topPlatforms: PlatformRow[];
};

function compactNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value || 0);
}

function formatHeaderDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
  }).format(date);
}

function formatShortDate(value?: string | null) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

function getBars(seed: string, positive = true) {
  const chars = seed.split("");
  return Array.from({ length: 18 }, (_, i) => {
    const code = chars[i % Math.max(chars.length, 1)]?.charCodeAt(0) || 65;
    const raw = 16 + ((code * (i + 5)) % 40);
    return {
      height: raw,
      positive,
    };
  });
}

export default function StatsClient({
  username,
  totals,
  globalSongs,
  userSongs,
  favoriteSongs,
  topCities,
  topRegions,
  topCountries,
  topPlatforms,
}: StatsClientProps) {
  const [sheetState, setSheetState] = useState<"collapsed" | "mid" | "open">("collapsed");
  const [dragStartY, setDragStartY] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0);

  const featuredRows = useMemo(() => {
    const topGlobal = globalSongs.slice(0, 4).map((row) => ({
      kind: "global" as const,
      row,
      statValue: row.playCount || 0,
      pillText: `${compactNumber(row.uniqueListenerCount || 0)} listeners`,
      positive: false,
      statLabel: "plays",
    }));

    const recentUser = userSongs.slice(0, 4).map((row) => ({
      kind: "user" as const,
      row,
      statValue: row.playCount || 0,
      pillText: row.lastPlayedAt ? formatShortDate(row.lastPlayedAt) : "recent",
      positive: true,
      statLabel: "your plays",
    }));

    return [...topGlobal, ...recentUser];
  }, [globalSongs, userSongs]);

  const sheetTranslateY =
    sheetState === "open" ? 0 :
    sheetState === "mid" ? 250 :
    470;

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    setDragStartY(e.clientY);
    setDragOffset(0);
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (dragStartY === null) return;
    setDragOffset(e.clientY - dragStartY);
  }

  function onPointerUp() {
    if (dragStartY === null) return;

    if (dragOffset < -70) {
      setSheetState((prev) => (prev === "collapsed" ? "mid" : "open"));
    } else if (dragOffset > 70) {
      setSheetState((prev) => (prev === "open" ? "mid" : "collapsed"));
    }

    setDragStartY(null);
    setDragOffset(0);
  }

  const computedTranslate =
    dragStartY === null
      ? sheetTranslateY
      : Math.max(0, sheetTranslateY + dragOffset);

  return (
    <main style={pageStyle}>
      <div style={topBarStyle}>
        <a href="/home" style={backLinkStyle}>← Home</a>

        <div style={topActionsStyle}>
          <button style={circleActionStyle} type="button" aria-label="Search">⌕</button>
          <button
            style={circleActionStyle}
            type="button"
            aria-label="Toggle Listening Pulse"
            onClick={() =>
              setSheetState((prev) =>
                prev === "collapsed" ? "mid" : prev === "mid" ? "open" : "collapsed"
              )
            }
          >
            •••
          </button>
        </div>
      </div>

      <div style={headerBlockStyle}>
        <h1 style={heroTitleStyle}>Stats</h1>
        <div style={heroDateStyle}>{formatHeaderDate()}</div>
      </div>

      <section style={listWrapStyle}>
        {featuredRows.length === 0 ? (
          <div style={emptyWrapStyle}>No song activity yet.</div>
        ) : (
          featuredRows.map((item) => (
            <MusicStatsRow
              key={`${item.kind}-${item.row.songSlug}`}
              coverImageUrl={item.row.coverImageUrl}
              title={item.row.title}
              subtitle={item.row.artistName || "Music activity"}
              statValue={item.statValue}
              statLabel={item.statLabel}
              pillText={item.pillText}
              positive={item.positive}
              seed={item.row.songSlug}
            />
          ))
        )}
      </section>

      <div
        style={{
          ...bottomSheetStyle,
          transform: `translateY(${computedTranslate}px)`,
          transition: dragStartY === null ? "transform 220ms ease" : "none",
        }}
      >
        <div
          style={sheetDragZoneStyle}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div style={sheetHandleStyle} />
        </div>

        <div style={sheetTopRowStyle}>
          <div>
            <div style={sheetTitleStyle}>Listening Pulse</div>
            <div style={sheetSubStyle}>From Caliphornia OS</div>
          </div>

          <div style={sheetActionsWrapStyle}>
            <button type="button" style={sheetToggleBtnStyle} onClick={() => setSheetState("collapsed")}>
              Hide
            </button>
            <button type="button" style={sheetToggleBtnStyle} onClick={() => setSheetState("open")}>
              Expand
            </button>
          </div>
        </div>

        <div style={sheetMetricsGridStyle}>
          <MetricMiniCard label="Your Plays" value={compactNumber(totals.totalUserPlays)} />
          <MetricMiniCard label="Favorites" value={compactNumber(totals.totalFavoriteSongs)} />
          <MetricMiniCard label="Global Plays" value={compactNumber(totals.totalGlobalPlays)} />
          <MetricMiniCard label="Reach" value={compactNumber(totals.totalGlobalReach)} />
        </div>

        <div style={sheetDividerStyle} />

        <div style={sheetSectionTitleStyle}>Music Insights</div>
        <div style={sheetListStyle}>
          <InsightSongRow
            title="Top Global Song"
            subtitle={
              globalSongs[0]
                ? `${globalSongs[0].title} · ${compactNumber(globalSongs[0].playCount || 0)} plays`
                : "No global song data yet"
            }
            coverImageUrl={globalSongs[0]?.coverImageUrl || null}
            accent="rgba(255, 69, 58, 0.95)"
          />

          <InsightSongRow
            title="Latest Favorite"
            subtitle={
              favoriteSongs[0]
                ? `${favoriteSongs[0].title} · saved ${formatShortDate(favoriteSongs[0].favoritedAt)}`
                : "No favorites yet"
            }
            coverImageUrl={favoriteSongs[0]?.coverImageUrl || null}
            accent="rgba(48, 209, 88, 0.95)"
          />

          <InsightSongRow
            title="Top Listener"
            subtitle={username ? `@${username}` : "Caliphornia OS user"}
            coverImageUrl={null}
            accent="rgba(10, 132, 255, 0.95)"
          />
        </div>

        <div style={sheetDividerStyle} />

        <div style={sheetSectionTitleStyle}>Location</div>
        <div style={gridTwoStyle}>
          <MiniStatList title="Top Cities" rows={topCities} />
          <MiniStatList title="Top Regions" rows={topRegions} />
          <MiniStatList title="Top Countries" rows={topCountries} />
          <MiniStatList title="Platforms" rows={topPlatforms} />
        </div>
      </div>
    </main>
  );
}

function MusicStatsRow({
  coverImageUrl,
  title,
  subtitle,
  statValue,
  statLabel,
  pillText,
  positive,
  seed,
}: {
  coverImageUrl: string | null;
  title: string;
  subtitle: string;
  statValue: number;
  statLabel: string;
  pillText: string;
  positive: boolean;
  seed: string;
}) {
  const bars = getBars(seed, positive);

  return (
    <div style={rowStyle}>
      <div style={rowLeftWrapStyle}>
        <div style={rowCoverWrapStyle}>
          {coverImageUrl ? (
            <img src={coverImageUrl} alt={title} style={rowCoverImageStyle} />
          ) : (
            <div style={rowCoverFallbackStyle}>{title.slice(0, 1).toUpperCase()}</div>
          )}
        </div>

        <div style={rowLeftStyle}>
          <div style={rowTitleStyle}>{title}</div>
          <div style={rowSubStyle}>{subtitle}</div>
        </div>
      </div>

      <div style={chartWrapStyle}>
        <div style={chartBarsStyle}>
          {bars.map((bar, index) => (
            <span
              key={`${seed}-${index}`}
              style={{
                ...chartBarStyle,
                height: `${bar.height}px`,
                background: positive
                  ? "linear-gradient(180deg, rgba(48, 209, 88, 0.95), rgba(48, 209, 88, 0.15))"
                  : "linear-gradient(180deg, rgba(255, 69, 58, 0.95), rgba(255, 69, 58, 0.15))",
              }}
            />
          ))}
        </div>
      </div>

      <div style={rowRightStyle}>
        <div style={rowValueStyle}>{compactNumber(statValue)}</div>
        <div
          style={{
            ...deltaPillStyle,
            background: positive
              ? "rgba(48, 209, 88, 0.92)"
              : "rgba(255, 69, 58, 0.96)",
          }}
        >
          {pillText}
        </div>
        <div style={rowLabelStyle}>{statLabel}</div>
      </div>
    </div>
  );
}

function MetricMiniCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div style={metricMiniCardStyle}>
      <div style={metricMiniLabelStyle}>{label}</div>
      <div style={metricMiniValueStyle}>{value}</div>
    </div>
  );
}

function InsightSongRow({
  title,
  subtitle,
  coverImageUrl,
  accent,
}: {
  title: string;
  subtitle: string;
  coverImageUrl: string | null;
  accent: string;
}) {
  return (
    <div style={insightSongRowStyle}>
      <div style={insightSongMediaWrapStyle}>
        {coverImageUrl ? (
          <img src={coverImageUrl} alt={title} style={insightSongMediaImageStyle} />
        ) : (
          <div
            style={{
              ...insightSongMediaFallbackStyle,
              boxShadow: `0 0 18px ${accent}`,
            }}
          >
            ●
          </div>
        )}
      </div>

      <div>
        <div style={insightTitleStyle}>{title}</div>
        <div style={insightSubStyle}>{subtitle}</div>
      </div>
    </div>
  );
}

function MiniStatList({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; count: number }[];
}) {
  return (
    <div style={miniListCardStyle}>
      <div style={miniListTitleStyle}>{title}</div>

      {rows.length === 0 ? (
        <div style={miniListEmptyStyle}>No data yet</div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {rows.slice(0, 5).map((row) => (
            <div key={`${title}-${row.label}`} style={miniListRowStyle}>
              <span style={miniListLabelStyle}>{row.label}</span>
              <span style={miniListValueStyle}>{compactNumber(row.count)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "#000",
  color: "#fff",
  padding: "18px 16px 220px",
  maxWidth: 920,
  margin: "0 auto",
};

const topBarStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 22,
};

const backLinkStyle: React.CSSProperties = {
  color: "rgba(255,255,255,0.84)",
  textDecoration: "none",
  fontSize: 16,
};

const topActionsStyle: React.CSSProperties = {
  display: "flex",
  gap: 10,
};

const circleActionStyle: React.CSSProperties = {
  minWidth: 54,
  height: 54,
  padding: "0 18px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.06)",
  display: "grid",
  placeItems: "center",
  fontSize: 26,
  lineHeight: 1,
  color: "#fff",
};

const headerBlockStyle: React.CSSProperties = {
  marginBottom: 24,
};

const heroTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 48,
  lineHeight: 0.95,
  letterSpacing: "-0.06em",
  fontWeight: 800,
};

const heroDateStyle: React.CSSProperties = {
  marginTop: 4,
  fontSize: 34,
  lineHeight: 0.95,
  letterSpacing: "-0.04em",
  color: "rgba(255,255,255,0.62)",
  fontWeight: 700,
};

const listWrapStyle: React.CSSProperties = {
  display: "grid",
  gap: 0,
  marginBottom: 22,
};

const rowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.5fr 150px 170px",
  gap: 16,
  alignItems: "center",
  padding: "18px 0",
  borderBottom: "1px solid rgba(255,255,255,0.12)",
};

const rowLeftWrapStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "58px 1fr",
  gap: 14,
  alignItems: "center",
  minWidth: 0,
};

const rowCoverWrapStyle: React.CSSProperties = {
  width: 58,
  height: 58,
  borderRadius: 12,
  overflow: "hidden",
  background: "rgba(255,255,255,0.08)",
};

const rowCoverImageStyle: React.CSSProperties = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
};

const rowCoverFallbackStyle: React.CSSProperties = {
  width: "100%",
  height: "100%",
  display: "grid",
  placeItems: "center",
  background: "linear-gradient(145deg, #2b2b2b, #161616)",
  fontWeight: 800,
};

const rowLeftStyle: React.CSSProperties = {
  minWidth: 0,
};

const rowTitleStyle: React.CSSProperties = {
  fontSize: 28,
  fontWeight: 800,
  letterSpacing: "-0.04em",
  lineHeight: 1,
};

const rowSubStyle: React.CSSProperties = {
  marginTop: 8,
  color: "rgba(255,255,255,0.58)",
  fontSize: 17,
  lineHeight: 1.4,
};

const chartWrapStyle: React.CSSProperties = {
  height: 76,
  display: "flex",
  alignItems: "end",
};

const chartBarsStyle: React.CSSProperties = {
  width: "100%",
  height: "100%",
  display: "grid",
  gridTemplateColumns: "repeat(18, 1fr)",
  alignItems: "end",
  gap: 3,
};

const chartBarStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  borderRadius: 999,
  opacity: 0.95,
};

const rowRightStyle: React.CSSProperties = {
  display: "grid",
  justifyItems: "end",
  gap: 8,
};

const rowValueStyle: React.CSSProperties = {
  fontSize: 28,
  fontWeight: 800,
  letterSpacing: "-0.04em",
};

const deltaPillStyle: React.CSSProperties = {
  minWidth: 120,
  padding: "10px 14px",
  borderRadius: 12,
  textAlign: "center",
  fontSize: 15,
  fontWeight: 700,
  color: "#fff",
};

const rowLabelStyle: React.CSSProperties = {
  fontSize: 12,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "rgba(255,255,255,0.5)",
};

const bottomSheetStyle: React.CSSProperties = {
  position: "fixed",
  left: "max(16px, env(safe-area-inset-left))",
  right: "max(16px, env(safe-area-inset-right))",
  bottom: "calc(18px + env(safe-area-inset-bottom))",
  borderRadius: 36,
  padding: "0 18px 20px",
  border: "1px solid rgba(255,255,255,0.12)",
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.12), rgba(255,255,255,0.04)), rgba(24,24,28,0.82)",
  backdropFilter: "blur(28px) saturate(150%)",
  WebkitBackdropFilter: "blur(28px) saturate(150%)",
  boxShadow: "0 22px 50px rgba(0,0,0,0.45)",
  maxWidth: 860,
  margin: "0 auto",
  touchAction: "none",
};

const sheetDragZoneStyle: React.CSSProperties = {
  paddingTop: 14,
  paddingBottom: 10,
  cursor: "grab",
};

const sheetHandleStyle: React.CSSProperties = {
  width: 58,
  height: 6,
  borderRadius: 999,
  background: "rgba(255,255,255,0.28)",
  margin: "0 auto",
};

const sheetTopRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
};

const sheetTitleStyle: React.CSSProperties = {
  fontSize: 34,
  fontWeight: 800,
  letterSpacing: "-0.05em",
  lineHeight: 1,
};

const sheetSubStyle: React.CSSProperties = {
  marginTop: 8,
  color: "rgba(255,255,255,0.66)",
  fontSize: 18,
  lineHeight: 1.35,
};

const sheetActionsWrapStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const sheetToggleBtnStyle: React.CSSProperties = {
  borderRadius: 999,
  padding: "10px 14px",
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.08)",
  color: "#fff",
  fontSize: 14,
};

const sheetMetricsGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 10,
  marginTop: 18,
};

const metricMiniCardStyle: React.CSSProperties = {
  borderRadius: 18,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.04)",
  padding: 14,
};

const metricMiniLabelStyle: React.CSSProperties = {
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "rgba(255,255,255,0.54)",
  marginBottom: 8,
};

const metricMiniValueStyle: React.CSSProperties = {
  fontSize: 24,
  fontWeight: 800,
  letterSpacing: "-0.04em",
};

const sheetDividerStyle: React.CSSProperties = {
  height: 1,
  background: "rgba(255,255,255,0.12)",
  margin: "16px 0",
};

const sheetSectionTitleStyle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 700,
  marginBottom: 12,
};

const sheetListStyle: React.CSSProperties = {
  display: "grid",
  gap: 12,
};

const insightSongRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "48px 1fr",
  gap: 12,
  alignItems: "center",
};

const insightSongMediaWrapStyle: React.CSSProperties = {
  width: 48,
  height: 48,
  borderRadius: 12,
  overflow: "hidden",
  background: "rgba(255,255,255,0.06)",
};

const insightSongMediaImageStyle: React.CSSProperties = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
};

const insightSongMediaFallbackStyle: React.CSSProperties = {
  width: "100%",
  height: "100%",
  display: "grid",
  placeItems: "center",
  background: "rgba(255,255,255,0.08)",
};

const insightTitleStyle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 700,
  letterSpacing: "-0.02em",
};

const insightSubStyle: React.CSSProperties = {
  marginTop: 4,
  color: "rgba(255,255,255,0.66)",
  fontSize: 15,
  lineHeight: 1.45,
};

const gridTwoStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 10,
  marginTop: 12,
};

const miniListCardStyle: React.CSSProperties = {
  borderRadius: 18,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.04)",
  padding: 14,
};

const miniListTitleStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  marginBottom: 12,
};

const miniListEmptyStyle: React.CSSProperties = {
  color: "rgba(255,255,255,0.62)",
  fontSize: 13,
};

const miniListRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  alignItems: "center",
};

const miniListLabelStyle: React.CSSProperties = {
  color: "rgba(255,255,255,0.76)",
  fontSize: 14,
};

const miniListValueStyle: React.CSSProperties = {
  fontWeight: 700,
  fontSize: 14,
};

const emptyWrapStyle: React.CSSProperties = {
  borderRadius: 22,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.04)",
  padding: 18,
  color: "rgba(255,255,255,0.72)",
};
