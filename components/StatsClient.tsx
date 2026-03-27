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

type SheetState = "peek" | "mid" | "open";

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

function getBars(seed: string, accent: "red" | "green" | "blue" = "red") {
  const chars = seed.split("");
  const bars = Array.from({ length: 16 }, (_, i) => {
    const code = chars[i % Math.max(chars.length, 1)]?.charCodeAt(0) || 65;
    return 16 + ((code * (i + 7)) % 34);
  });

  const color =
    accent === "green"
      ? "linear-gradient(180deg, rgba(48,209,88,0.95), rgba(48,209,88,0.18))"
      : accent === "blue"
      ? "linear-gradient(180deg, rgba(10,132,255,0.95), rgba(10,132,255,0.18))"
      : "linear-gradient(180deg, rgba(255,69,58,0.95), rgba(255,69,58,0.18))";

  return { bars, color };
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
  const [sheetState, setSheetState] = useState<SheetState>("peek");
  const [dragStartY, setDragStartY] = useState<number | null>(null);
  const [dragCurrentY, setDragCurrentY] = useState<number | null>(null);

  const sheetBaseY =
    sheetState === "open" ? 0 : sheetState === "mid" ? 260 : 560;

  const dragDelta =
    dragStartY !== null && dragCurrentY !== null ? dragCurrentY - dragStartY : 0;

  const translateY =
    dragStartY !== null
      ? Math.max(0, sheetBaseY + dragDelta)
      : sheetBaseY;

  const topGlobalRows = useMemo(
    () => globalSongs.slice(0, 6),
    [globalSongs]
  );

  const recentUserRows = useMemo(
    () => userSongs.slice(0, 6),
    [userSongs]
  );

  function cycleSheet() {
    setSheetState((prev) =>
      prev === "peek" ? "mid" : prev === "mid" ? "open" : "peek"
    );
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    setDragStartY(e.clientY);
    setDragCurrentY(e.clientY);
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (dragStartY === null) return;
    setDragCurrentY(e.clientY);
  }

  function onPointerUp() {
    if (dragStartY === null || dragCurrentY === null) {
      setDragStartY(null);
      setDragCurrentY(null);
      return;
    }

    const delta = dragCurrentY - dragStartY;

    if (delta < -70) {
      setSheetState((prev) =>
        prev === "peek" ? "mid" : "open"
      );
    } else if (delta > 70) {
      setSheetState((prev) =>
        prev === "open" ? "mid" : "peek"
      );
    }

    setDragStartY(null);
    setDragCurrentY(null);
  }

  return (
    <main style={pageStyle}>
      <div style={topBarStyle}>
        <a href="/home" style={backLinkStyle}>← Home</a>

        <div style={topActionsStyle}>
          <button style={circleActionStyle} type="button" aria-label="Search">
            ⌕
          </button>
          <button
            style={circleActionStyle}
            type="button"
            aria-label="Toggle Listening Pulse"
            onClick={cycleSheet}
          >
            •••
          </button>
        </div>
      </div>

      <div style={headerBlockStyle}>
        <h1 style={heroTitleStyle}>Stats</h1>
        <div style={heroDateStyle}>{formatHeaderDate()}</div>
      </div>

      <section style={sectionStyle}>
        {topGlobalRows.map((row) => (
          <StatsRow
            key={`global-${row.songSlug}`}
            coverImageUrl={row.coverImageUrl}
            title={row.title}
            subtitle={row.artistName || "Unknown artist"}
            rightTop={compactNumber(row.playCount || 0)}
            rightBottom={`${compactNumber(row.uniqueListenerCount || 0)} listeners`}
            rightBottomAccent="red"
            barsSeed={row.songSlug}
            barsAccent="red"
          />
        ))}
      </section>

      <section style={{ ...sectionStyle, marginBottom: 120 }}>
        {recentUserRows.map((row) => (
          <StatsRow
            key={`user-${row.songSlug}`}
            coverImageUrl={row.coverImageUrl}
            title={row.title}
            subtitle={row.artistName || "Unknown artist"}
            rightTop={compactNumber(row.playCount || 0)}
            rightBottom={formatShortDate(row.lastPlayedAt)}
            rightBottomAccent="green"
            barsSeed={`${row.songSlug}-${row.lastPlayedAt || ""}`}
            barsAccent="green"
          />
        ))}
      </section>

      <div
        style={{
          ...bottomSheetStyle,
          transform: `translateY(${translateY}px)`,
          transition: dragStartY === null ? "transform 260ms ease" : "none",
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
          <div style={sheetPeekHeaderStyle}>
            <div>
              <div style={sheetPeekTitleStyle}>Listening Pulse</div>
              <div style={sheetPeekSubStyle}>From Caliphornia OS</div>
            </div>

            <button
              type="button"
              onClick={cycleSheet}
              style={sheetPeekButtonStyle}
            >
              {sheetState === "peek" ? "Open" : sheetState === "mid" ? "Expand" : "Minimize"}
            </button>
          </div>
        </div>

        <div style={sheetContentStyle}>
          <div style={metricsGridStyle}>
            <MetricCard label="Your Plays" value={compactNumber(totals.totalUserPlays)} />
            <MetricCard label="Favorites" value={compactNumber(totals.totalFavoriteSongs)} />
            <MetricCard label="Global Plays" value={compactNumber(totals.totalGlobalPlays)} />
            <MetricCard label="Reach" value={compactNumber(totals.totalGlobalReach)} />
          </div>

          <div style={sheetDividerStyle} />

          <div style={sheetSectionTitleStyle}>Music Highlights</div>
          <div style={sheetBlockGridStyle}>
            <InsightCard
              title="Top Global Song"
              subtitle={
                globalSongs[0]
                  ? `${globalSongs[0].title} · ${compactNumber(globalSongs[0].playCount || 0)} plays`
                  : "No global stats yet"
              }
              coverImageUrl={globalSongs[0]?.coverImageUrl || null}
            />

            <InsightCard
              title="Latest Favorite"
              subtitle={
                favoriteSongs[0]
                  ? `${favoriteSongs[0].title} · saved ${formatShortDate(favoriteSongs[0].favoritedAt)}`
                  : "No favorites yet"
              }
              coverImageUrl={favoriteSongs[0]?.coverImageUrl || null}
            />

            <InsightCard
              title="Listener"
              subtitle={username ? `@${username}` : "Caliphornia OS user"}
              coverImageUrl={null}
            />
          </div>

          <div style={sheetDividerStyle} />

          <div style={sheetSectionTitleStyle}>Location Insights</div>
          <div style={locationGridStyle}>
            <MiniStatList title="Cities" rows={topCities} />
            <MiniStatList title="Regions" rows={topRegions} />
            <MiniStatList title="Countries" rows={topCountries} />
            <MiniStatList title="Platforms" rows={topPlatforms} />
          </div>
        </div>
      </div>
    </main>
  );
}

function StatsRow({
  coverImageUrl,
  title,
  subtitle,
  rightTop,
  rightBottom,
  rightBottomAccent,
  barsSeed,
  barsAccent,
}: {
  coverImageUrl: string | null;
  title: string;
  subtitle: string;
  rightTop: string;
  rightBottom: string;
  rightBottomAccent: "red" | "green";
  barsSeed: string;
  barsAccent: "red" | "green" | "blue";
}) {
  const { bars, color } = getBars(barsSeed, barsAccent);

  return (
    <div style={rowStyle}>
      <div style={coverCellStyle}>
        {coverImageUrl ? (
          <img src={coverImageUrl} alt={title} style={coverImageStyle} />
        ) : (
          <div style={coverFallbackStyle}>{title.slice(0, 1).toUpperCase()}</div>
        )}
      </div>

      <div style={textCellStyle}>
        <div style={rowTitleStyle}>{title}</div>
        <div style={rowSubStyle}>{subtitle}</div>
      </div>

      <div style={chartCellStyle}>
        <div style={barsWrapStyle}>
          {bars.map((height, i) => (
            <span
              key={`${barsSeed}-${i}`}
              style={{
                ...barStyle,
                height,
                background: color,
              }}
            />
          ))}
        </div>
      </div>

      <div style={rightCellStyle}>
        <div style={rightTopStyle}>{rightTop}</div>
        <div
          style={{
            ...rightPillStyle,
            background:
              rightBottomAccent === "green"
                ? "rgba(48,209,88,0.95)"
                : "rgba(255,69,58,0.96)",
          }}
        >
          {rightBottom}
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div style={metricCardStyle}>
      <div style={metricLabelStyle}>{label}</div>
      <div style={metricValueStyle}>{value}</div>
    </div>
  );
}

function InsightCard({
  title,
  subtitle,
  coverImageUrl,
}: {
  title: string;
  subtitle: string;
  coverImageUrl: string | null;
}) {
  return (
    <div style={insightCardStyle}>
      <div style={insightMediaWrapStyle}>
        {coverImageUrl ? (
          <img src={coverImageUrl} alt={title} style={insightMediaImageStyle} />
        ) : (
          <div style={insightMediaFallbackStyle}>●</div>
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
        <div style={miniEmptyStyle}>No data yet</div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {rows.slice(0, 5).map((row) => (
            <div key={`${title}-${row.label}`} style={miniRowStyle}>
              <span style={miniLabelStyle}>{row.label}</span>
              <span style={miniValueStyle}>{compactNumber(row.count)}</span>
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
  padding: "18px 16px 140px",
  maxWidth: 980,
  margin: "0 auto",
};

const topBarStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 24,
};

const backLinkStyle: React.CSSProperties = {
  color: "rgba(255,255,255,0.84)",
  textDecoration: "none",
  fontSize: 16,
};

const topActionsStyle: React.CSSProperties = {
  display: "flex",
  gap: 12,
};

const circleActionStyle: React.CSSProperties = {
  minWidth: 56,
  height: 56,
  padding: "0 18px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.05)",
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
  fontSize: 54,
  lineHeight: 0.92,
  letterSpacing: "-0.06em",
  fontWeight: 800,
};

const heroDateStyle: React.CSSProperties = {
  marginTop: 4,
  fontSize: 36,
  lineHeight: 0.95,
  letterSpacing: "-0.04em",
  color: "rgba(255,255,255,0.62)",
  fontWeight: 700,
};

const sectionStyle: React.CSSProperties = {
  display: "grid",
  gap: 0,
};

const rowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "64px minmax(0, 1.35fr) 150px 160px",
  gap: 16,
  alignItems: "center",
  padding: "18px 0",
  borderBottom: "1px solid rgba(255,255,255,0.12)",
};

const coverCellStyle: React.CSSProperties = {
  width: 64,
  height: 64,
  borderRadius: 14,
  overflow: "hidden",
  background: "rgba(255,255,255,0.08)",
};

const coverImageStyle: React.CSSProperties = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
};

const coverFallbackStyle: React.CSSProperties = {
  width: "100%",
  height: "100%",
  display: "grid",
  placeItems: "center",
  background: "linear-gradient(145deg, #2b2b2b, #161616)",
  fontWeight: 800,
  fontSize: 24,
};

const textCellStyle: React.CSSProperties = {
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
  fontSize: 16,
  lineHeight: 1.35,
};

const chartCellStyle: React.CSSProperties = {
  height: 78,
  display: "flex",
  alignItems: "end",
};

const barsWrapStyle: React.CSSProperties = {
  width: "100%",
  height: "100%",
  display: "grid",
  gridTemplateColumns: "repeat(16, 1fr)",
  alignItems: "end",
  gap: 4,
};

const barStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  borderRadius: 999,
  opacity: 0.96,
};

const rightCellStyle: React.CSSProperties = {
  display: "grid",
  justifyItems: "end",
  gap: 10,
};

const rightTopStyle: React.CSSProperties = {
  fontSize: 30,
  fontWeight: 800,
  letterSpacing: "-0.04em",
};

const rightPillStyle: React.CSSProperties = {
  minWidth: 126,
  padding: "11px 14px",
  borderRadius: 14,
  textAlign: "center",
  fontSize: 16,
  fontWeight: 700,
  color: "#fff",
};

const bottomSheetStyle: React.CSSProperties = {
  position: "fixed",
  left: "max(16px, env(safe-area-inset-left))",
  right: "max(16px, env(safe-area-inset-right))",
  bottom: "calc(18px + env(safe-area-inset-bottom))",
  borderRadius: 34,
  border: "1px solid rgba(255,255,255,0.12)",
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.12), rgba(255,255,255,0.04)), rgba(24,24,28,0.82)",
  backdropFilter: "blur(28px) saturate(150%)",
  WebkitBackdropFilter: "blur(28px) saturate(150%)",
  boxShadow: "0 22px 50px rgba(0,0,0,0.45)",
  maxWidth: 900,
  margin: "0 auto",
  touchAction: "none",
  overflow: "hidden",
};

const sheetDragZoneStyle: React.CSSProperties = {
  padding: "14px 18px 16px",
  cursor: "grab",
  borderBottom: "1px solid rgba(255,255,255,0.08)",
};

const sheetHandleStyle: React.CSSProperties = {
  width: 58,
  height: 6,
  borderRadius: 999,
  background: "rgba(255,255,255,0.28)",
  margin: "0 auto 14px",
};

const sheetPeekHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
};

const sheetPeekTitleStyle: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 800,
  letterSpacing: "-0.04em",
  lineHeight: 1,
};

const sheetPeekSubStyle: React.CSSProperties = {
  marginTop: 6,
  color: "rgba(255,255,255,0.66)",
  fontSize: 15,
};

const sheetPeekButtonStyle: React.CSSProperties = {
  borderRadius: 999,
  padding: "10px 14px",
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.08)",
  color: "#fff",
  fontSize: 14,
};

const sheetContentStyle: React.CSSProperties = {
  padding: "16px 18px 20px",
  maxHeight: "68vh",
  overflow: "auto",
};

const metricsGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 12,
};

const metricCardStyle: React.CSSProperties = {
  borderRadius: 18,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.04)",
  padding: 14,
};

const metricLabelStyle: React.CSSProperties = {
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "rgba(255,255,255,0.54)",
  marginBottom: 8,
};

const metricValueStyle: React.CSSProperties = {
  fontSize: 24,
  fontWeight: 800,
  letterSpacing: "-0.04em",
};

const sheetDividerStyle: React.CSSProperties = {
  height: 1,
  background: "rgba(255,255,255,0.12)",
  margin: "18px 0",
};

const sheetSectionTitleStyle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 700,
  marginBottom: 12,
};

const sheetBlockGridStyle: React.CSSProperties = {
  display: "grid",
  gap: 12,
};

const insightCardStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "48px 1fr",
  gap: 12,
  alignItems: "center",
};

const insightMediaWrapStyle: React.CSSProperties = {
  width: 48,
  height: 48,
  borderRadius: 12,
  overflow: "hidden",
  background: "rgba(255,255,255,0.06)",
};

const insightMediaImageStyle: React.CSSProperties = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
};

const insightMediaFallbackStyle: React.CSSProperties = {
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
  lineHeight: 1.4,
};

const locationGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 12,
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

const miniEmptyStyle: React.CSSProperties = {
  color: "rgba(255,255,255,0.62)",
  fontSize: 13,
};

const miniRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  alignItems: "center",
};

const miniLabelStyle: React.CSSProperties = {
  color: "rgba(255,255,255,0.76)",
  fontSize: 14,
};

const miniValueStyle: React.CSSProperties = {
  fontWeight: 700,
  fontSize: 14,
};
