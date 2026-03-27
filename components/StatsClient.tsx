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

function getActivityBars(seed: string, positive = true) {
  const chars = seed.split("");
  return Array.from({ length: 18 }, (_, i) => {
    const code = chars[i % Math.max(chars.length, 1)]?.charCodeAt(0) || 65;
    const raw = 18 + ((code * (i + 3)) % 42);
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
}: StatsClientProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [dragStartY, setDragStartY] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0);

  const featuredRows = useMemo(() => {
    return [
      ...globalSongs.slice(0, 4).map((row) => ({
        kind: "global" as const,
        row,
        statValue: row.playCount || 0,
        deltaLabel: `${compactNumber(row.uniqueListenerCount || 0)} listeners`,
        positive: false,
        statLabel: "plays",
      })),
      ...userSongs.slice(0, 4).map((row) => ({
        kind: "user" as const,
        row,
        statValue: row.playCount || 0,
        deltaLabel: row.lastPlayedAt ? formatShortDate(row.lastPlayedAt) : "recent",
        positive: true,
        statLabel: "your plays",
      })),
    ];
  }, [globalSongs, userSongs]);

  const newestFavorite = favoriteSongs[0] || null;
  const topGlobalSong = globalSongs[0] || null;

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    setDragStartY(e.clientY);
    setDragOffset(0);
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (dragStartY === null) return;
    const delta = e.clientY - dragStartY;
    setDragOffset(delta);
  }

  function onPointerUp() {
    if (dragStartY === null) return;

    if (!sheetOpen && dragOffset < -50) {
      setSheetOpen(true);
    } else if (sheetOpen && dragOffset > 50) {
      setSheetOpen(false);
    }

    setDragStartY(null);
    setDragOffset(0);
  }

  const translateY = sheetOpen
    ? Math.max(0, dragOffset)
    : Math.max(0, 320 + dragOffset);

  return (
    <main style={pageStyle}>
      <div style={topBarStyle}>
        <a href="/home" style={backLinkStyle}>← Home</a>

        <div style={topActionsStyle}>
          <button style={circleActionStyle} type="button" aria-label="Search">⌕</button>
          <button
            style={circleActionStyle}
            type="button"
            aria-label={sheetOpen ? "Hide Listening Pulse" : "Show Listening Pulse"}
            onClick={() => setSheetOpen((prev) => !prev)}
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
              title={item.row.title}
              subtitle={
                item.kind === "global"
                  ? item.row.artistName || "Global song activity"
                  : item.row.artistName || "Your recent activity"
              }
              statValue={item.statValue}
              statLabel={item.statLabel}
              deltaLabel={item.deltaLabel}
              positive={item.positive}
              seed={item.row.songSlug}
            />
          ))
        )}
      </section>

      <div
        style={{
          ...bottomSheetStyle,
          transform: `translateY(${translateY}px)`,
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

          <button
            type="button"
            onClick={() => setSheetOpen((prev) => !prev)}
            style={sheetToggleBtnStyle}
          >
            {sheetOpen ? "Hide" : "Show"}
          </button>
        </div>

        <div style={sheetMetricsGridStyle}>
          <MetricMiniCard label="Your Plays" value={compactNumber(totals.totalUserPlays)} />
          <MetricMiniCard label="Global Plays" value={compactNumber(totals.totalGlobalPlays)} />
          <MetricMiniCard label="Reach" value={compactNumber(totals.totalGlobalReach)} />
          <MetricMiniCard label="Favorites" value={compactNumber(totals.totalFavoriteSongs)} />
        </div>

        <div style={sheetDividerStyle} />

        <BottomInsightBlock
          title="Your Favorites"
          subtitle={
            newestFavorite
              ? `${newestFavorite.title} · saved ${formatShortDate(newestFavorite.favoritedAt)}`
              : "No favorites yet"
          }
          accent="rgba(90, 210, 106, 0.95)"
        />

        <div style={sheetDividerStyle} />

        <BottomInsightBlock
          title="Top Global Song"
          subtitle={
            topGlobalSong
              ? `${topGlobalSong.title} · ${compactNumber(topGlobalSong.playCount || 0)} plays`
              : "No global stats yet"
          }
          accent="rgba(255, 69, 58, 0.95)"
        />

        <div style={sheetDividerStyle} />

        <BottomInsightBlock
          title="Listener"
          subtitle={username ? `@${username}` : "Caliphornia OS user"}
          accent="rgba(10, 132, 255, 0.95)"
        />
      </div>
    </main>
  );
}

function MusicStatsRow({
  title,
  subtitle,
  statValue,
  statLabel,
  deltaLabel,
  positive,
  seed,
}: {
  title: string;
  subtitle: string;
  statValue: number;
  statLabel: string;
  deltaLabel: string;
  positive: boolean;
  seed: string;
}) {
  const bars = getActivityBars(seed, positive);

  return (
    <div style={rowStyle}>
      <div style={rowLeftStyle}>
        <div style={rowTitleStyle}>{title}</div>
        <div style={rowSubStyle}>{subtitle}</div>
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
          {deltaLabel}
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

function BottomInsightBlock({
  title,
  subtitle,
  accent,
}: {
  title: string;
  subtitle: string;
  accent: string;
}) {
  return (
    <div style={insightRowStyle}>
      <div
        style={{
          ...insightDotStyle,
          background: accent,
          boxShadow: `0 0 20px ${accent}`,
        }}
      />
      <div>
        <div style={insightTitleStyle}>{title}</div>
        <div style={insightSubStyle}>{subtitle}</div>
      </div>
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
  gridTemplateColumns: "1.25fr 150px 170px",
  gap: 16,
  alignItems: "center",
  padding: "18px 0",
  borderBottom: "1px solid rgba(255,255,255,0.12)",
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
  minWidth: 110,
  padding: "10px 14px",
  borderRadius: 12,
  textAlign: "center",
  fontSize: 16,
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

const insightRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "14px 1fr",
  gap: 14,
  alignItems: "start",
};

const insightDotStyle: React.CSSProperties = {
  width: 14,
  height: 14,
  borderRadius: 999,
  marginTop: 4,
};

const insightTitleStyle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 700,
  letterSpacing: "-0.02em",
};

const insightSubStyle: React.CSSProperties = {
  marginTop: 4,
  color: "rgba(255,255,255,0.66)",
  fontSize: 16,
  lineHeight: 1.45,
};

const emptyWrapStyle: React.CSSProperties = {
  borderRadius: 22,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.04)",
  padding: 18,
  color: "rgba(255,255,255,0.72)",
};
