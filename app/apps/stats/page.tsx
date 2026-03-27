import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase-admin";

async function createSignedCoverUrl(storagePath: string | null | undefined) {
  if (!storagePath) return null;

  const { data, error } = await supabaseAdmin.storage
    .from("cover-art")
    .createSignedUrl(storagePath, 60 * 60);

  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

type SongCard = {
  songSlug: string;
  songId?: string;
  title: string;
  artistName: string;
  producerNames: string;
  appSlug: string;
  durationLabel: string;
  coverImageUrl: string | null;
  playCount?: number;
  uniqueListenerCount?: number;
  isFavorite?: boolean;
  lastPlayedAt?: string | null;
  favoritedAt?: string | null;
  userPlayCount?: number;
  globalPlayCount?: number;
};

function sum<T>(rows: T[], getter: (row: T) => number) {
  return rows.reduce((acc, row) => acc + getter(row), 0);
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return "—";
  }
}

function formatShortDate(value?: string | null) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString();
  } catch {
    return "—";
  }
}

function compactNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value || 0);
}

function getHeatScore(playCount: number, uniqueListenerCount: number) {
  return playCount * 2 + uniqueListenerCount * 5;
}

export default async function StatsPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("caliph_os_session")?.value ?? null;
  const session = verifySession(token);

  if (!session?.email) {
    redirect("/");
  }

  const userEmail = session.email;

  const [globalStatsRes, userStatsRes, favoritesRes, songsRes] = await Promise.all([
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
  ]);

  if (globalStatsRes.error || userStatsRes.error || favoritesRes.error || songsRes.error) {
    return (
      <main style={pageStyle}>
        <div style={heroShellStyle}>
          <a href="/home" style={backLinkStyle}>← Home</a>
          <h1 style={titleStyle}>Stats</h1>
          <p style={subtitleStyle}>Could not load stats.</p>
        </div>
      </main>
    );
  }

  const songs = songsRes.data || [];
  const songMap = new Map(songs.map((song) => [song.slug, song]));

  const favoriteSlugSet = new Set(
    (favoritesRes.data || []).map((row) => row.song_slug).filter(Boolean)
  );

  const favoriteCreatedAtMap = new Map(
    (favoritesRes.data || []).map((row) => [row.song_slug, row.created_at])
  );

  const globalSongs: SongCard[] = await Promise.all(
    (globalStatsRes.data || []).map(async (row) => {
      const song = songMap.get(row.song_slug);
      const coverImageUrl = await createSignedCoverUrl(song?.cover_image_path);

      return {
        songSlug: row.song_slug,
        songId: row.song_id,
        title: song?.title || row.song_slug,
        artistName: song?.artist_name || "",
        producerNames: song?.producer_names || "",
        appSlug: song?.source_app_slug || "",
        durationLabel: song?.duration_label || "",
        coverImageUrl,
        playCount: row.play_count || 0,
        uniqueListenerCount: row.unique_listener_count || 0,
        isFavorite: favoriteSlugSet.has(row.song_slug),
      };
    })
  );

  const userSongs: SongCard[] = await Promise.all(
    (userStatsRes.data || []).map(async (row) => {
      const song = songMap.get(row.song_slug);
      const coverImageUrl = await createSignedCoverUrl(song?.cover_image_path);

      return {
        songSlug: row.song_slug,
        songId: row.song_id,
        title: song?.title || row.song_slug,
        artistName: song?.artist_name || "",
        producerNames: song?.producer_names || "",
        appSlug: song?.source_app_slug || "",
        durationLabel: song?.duration_label || "",
        coverImageUrl,
        playCount: row.play_count || 0,
        lastPlayedAt: row.last_played_at || null,
        isFavorite: favoriteSlugSet.has(row.song_slug),
      };
    })
  );

  const favoriteSongs: SongCard[] = await Promise.all(
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

  const topGlobalSong = globalSongs[0] || null;
  const topUserSong = [...userSongs].sort((a, b) => (b.playCount || 0) - (a.playCount || 0))[0] || null;
  const newestFavorite = favoriteSongs[0] || null;

  const totalGlobalPlays = sum(globalSongs, (row) => row.playCount || 0);
  const totalGlobalReach = sum(globalSongs, (row) => row.uniqueListenerCount || 0);
  const totalUserPlays = sum(userSongs, (row) => row.playCount || 0);
  const totalFavoriteSongs = favoriteSongs.length;

  const hottestSongs = [...globalSongs]
    .map((row) => ({
      ...row,
      heatScore: getHeatScore(row.playCount || 0, row.uniqueListenerCount || 0),
    }))
    .sort((a, b) => b.heatScore - a.heatScore)
    .slice(0, 5);

  const appBreakdownMap = new Map<string, { plays: number; songs: number }>();
  for (const row of userSongs) {
    const key = row.appSlug || "unknown";
    const current = appBreakdownMap.get(key) || { plays: 0, songs: 0 };
    current.plays += row.playCount || 0;
    current.songs += 1;
    appBreakdownMap.set(key, current);
  }

  const appBreakdown = Array.from(appBreakdownMap.entries())
    .map(([appSlug, data]) => ({
      appSlug,
      ...data,
    }))
    .sort((a, b) => b.plays - a.plays);

  const totals = {
    totalUserPlayedSongs: userSongs.length,
    totalFavoriteSongs,
    totalUserPlays,
    totalGlobalPlays,
    totalGlobalReach,
  };

  return (
    <main style={pageStyle}>
      <div style={heroShellStyle}>
        <div style={heroGlowOne} />
        <div style={heroGlowTwo} />

        <a href="/home" style={backLinkStyle}>← Home</a>

        <div style={heroTopRowStyle}>
          <div>
            <div style={eyebrowStyle}>Caliphornia OS</div>
            <h1 style={titleStyle}>Stats</h1>
            <p style={subtitleStyle}>
              A live pulse of your listening world, top-performing songs, favorites, and audience energy.
            </p>
          </div>

          <div style={heroBadgeStyle}>
            <div style={heroBadgeLabelStyle}>Active listener</div>
            <div style={heroBadgeValueStyle}>@{session.username || "user"}</div>
          </div>
        </div>
      </div>

      <section style={topMetricsGridStyle}>
        <MetricCard label="Your Plays" value={compactNumber(totals.totalUserPlays)} />
        <MetricCard label="Your Favorites" value={compactNumber(totals.totalFavoriteSongs)} />
        <MetricCard label="Global Plays" value={compactNumber(totals.totalGlobalPlays)} />
        <MetricCard label="Global Reach" value={compactNumber(totals.totalGlobalReach)} />
      </section>

      <section style={featureGridStyle}>
        <SpotlightCard
          title="Top Global Song"
          subtitle="Most played across the whole ecosystem"
          song={topGlobalSong}
          statLabel="Global plays"
          statValue={topGlobalSong?.playCount || 0}
        />

        <SpotlightCard
          title="Your Top Song"
          subtitle="Your personal most-played record"
          song={topUserSong}
          statLabel="Your plays"
          statValue={topUserSong?.playCount || 0}
        />

        <SpotlightCard
          title="Latest Favorite"
          subtitle="Most recently added to favorites"
          song={newestFavorite}
          statLabel="Favorited"
          statValue={formatShortDate(newestFavorite?.favoritedAt)}
          valueIsText
        />
      </section>

      <section style={gridTwoStyle}>
        <GlassSection title="Hottest Songs Right Now" subtitle="Weighted by plays and listener reach">
          <RankedSongList
            rows={hottestSongs}
            mode="heat"
          />
        </GlassSection>

        <GlassSection
          title="Your App Breakdown"
          subtitle="Where your listening activity is happening"
        >
          {appBreakdown.length === 0 ? (
            <EmptyState text="No user listening activity yet." />
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {appBreakdown.map((row) => (
                <div key={row.appSlug} style={miniRowStyle}>
                  <div>
                    <div style={miniRowTitleStyle}>{row.appSlug || "unknown"}</div>
                    <div style={miniRowSubStyle}>{row.songs} songs played</div>
                  </div>
                  <div style={miniPillStyle}>{compactNumber(row.plays)} plays</div>
                </div>
              ))}
            </div>
          )}
        </GlassSection>
      </section>

      <section style={gridTwoStyle}>
        <GlassSection
          title="Location Insights"
          subtitle="Ready for geo activity once location data is tracked"
        >
          <div style={locationCardStyle}>
            <div style={locationIconStyle}>◎</div>
            <div>
              <div style={locationTitleStyle}>Location data not connected yet</div>
              <div style={locationSubStyle}>
                Your current stats tables do not include city, state, coordinates, or region fields.
                Once you add location capture, this section can show hotspots, city rankings, and map-based activity.
              </div>
            </div>
          </div>
        </GlassSection>

        <GlassSection
          title="Recent Activity"
          subtitle="The songs you touched most recently"
        >
          <RecentActivityList rows={userSongs.slice(0, 5)} />
        </GlassSection>
      </section>

      <GlassSection title="Top Global Songs" subtitle="Overall performance across all listeners">
        <StatsSection rows={globalSongs} mode="global" />
      </GlassSection>

      <GlassSection title="Your Song Activity" subtitle="Your personal listening behavior">
        <StatsSection rows={userSongs} mode="user" />
      </GlassSection>

      <GlassSection title="Your Favorite Songs" subtitle="Saved songs with personal and global context">
        <StatsSection rows={favoriteSongs} mode="favorites" />
      </GlassSection>
    </main>
  );
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={metricCardStyle}>
      <div style={metricLabelStyle}>{label}</div>
      <div style={metricValueStyle}>{value}</div>
    </div>
  );
}

function GlassSection({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section style={glassSectionStyle}>
      <div style={{ marginBottom: 16 }}>
        <h2 style={sectionTitleStyle}>{title}</h2>
        {subtitle ? <p style={sectionSubtitleStyle}>{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}

function SpotlightCard({
  title,
  subtitle,
  song,
  statLabel,
  statValue,
  valueIsText = false,
}: {
  title: string;
  subtitle: string;
  song: SongCard | null;
  statLabel: string;
  statValue: string | number;
  valueIsText?: boolean;
}) {
  return (
    <div style={spotlightCardStyle}>
      <div style={spotlightGlowStyle} />
      <div style={{ position: "relative", zIndex: 1 }}>
        <div style={spotlightLabelStyle}>{title}</div>
        <div style={spotlightSubStyle}>{subtitle}</div>

        {song ? (
          <div style={spotlightBodyStyle}>
            <div style={spotlightCoverWrapStyle}>
              {song.coverImageUrl ? (
                <img src={song.coverImageUrl} alt={song.title} style={spotlightCoverImageStyle} />
              ) : (
                <div style={spotlightCoverFallbackStyle}>
                  {String(song.title || "?").slice(0, 1).toUpperCase()}
                </div>
              )}
            </div>

            <div>
              <div style={spotlightSongTitleStyle}>{song.title}</div>
              <div style={spotlightSongMetaStyle}>{song.artistName || "Unknown artist"}</div>
              <div style={spotlightStatStyle}>
                <span style={spotlightStatLabelStyle}>{statLabel}</span>
                <span style={valueIsText ? spotlightStatValueTextStyle : spotlightStatValueStyle}>
                  {valueIsText ? String(statValue) : compactNumber(Number(statValue) || 0)}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <EmptyState text="No song data yet." />
        )}
      </div>
    </div>
  );
}

function RankedSongList({
  rows,
  mode,
}: {
  rows: Array<SongCard & { heatScore?: number }>;
  mode: "heat";
}) {
  if (rows.length === 0) {
    return <EmptyState text="No ranking data yet." />;
  }

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {rows.map((row, index) => (
        <div key={row.songSlug} style={rankRowStyle}>
          <div style={rankNumberStyle}>{index + 1}</div>
          <div style={rankBodyStyle}>
            <div style={rankTitleStyle}>{row.title}</div>
            <div style={rankSubStyle}>
              {row.artistName || "Unknown artist"} · {compactNumber(row.playCount || 0)} plays ·{" "}
              {compactNumber(row.uniqueListenerCount || 0)} listeners
            </div>
          </div>
          <div style={rankPillStyle}>{compactNumber(row.heatScore || 0)} heat</div>
        </div>
      ))}
    </div>
  );
}

function RecentActivityList({ rows }: { rows: SongCard[] }) {
  if (rows.length === 0) {
    return <EmptyState text="No recent activity yet." />;
  }

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {rows.map((row) => (
        <div key={row.songSlug} style={miniRowStyle}>
          <div>
            <div style={miniRowTitleStyle}>{row.title}</div>
            <div style={miniRowSubStyle}>
              {row.artistName || "Unknown artist"} · {formatDateTime(row.lastPlayedAt)}
            </div>
          </div>
          <div style={miniPillStyle}>{compactNumber(row.playCount || 0)} plays</div>
        </div>
      ))}
    </div>
  );
}

function StatsSection({
  rows,
  mode,
}: {
  rows: SongCard[];
  mode: "global" | "user" | "favorites";
}) {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      {rows.length === 0 ? (
        <EmptyState text="No data yet." />
      ) : (
        rows.map((row) => (
          <div key={`${mode}-${row.songSlug}`} style={rowCardStyle}>
            <div style={coverWrapStyle}>
              {row.coverImageUrl ? (
                <img src={row.coverImageUrl} alt={row.title} style={coverImageStyle} />
              ) : (
                <div style={coverFallbackStyle}>
                  <span>{String(row.title || "?").slice(0, 1).toUpperCase()}</span>
                </div>
              )}
            </div>

            <div>
              <div style={songTitleStyle}>{row.title}</div>
              <div style={songMetaStyle}>
                {row.artistName || "Unknown artist"}
                {row.appSlug ? ` · ${row.appSlug}` : ""}
              </div>

              <div style={statsLineStyle}>
                {mode === "global" ? (
                  <>
                    <span>Plays: {compactNumber(row.playCount || 0)}</span>
                    <span>Listeners: {compactNumber(row.uniqueListenerCount || 0)}</span>
                    {row.isFavorite ? <span>Favorited by you</span> : null}
                  </>
                ) : null}

                {mode === "user" ? (
                  <>
                    <span>Plays: {compactNumber(row.playCount || 0)}</span>
                    <span>Last Played: {formatDateTime(row.lastPlayedAt)}</span>
                    {row.isFavorite ? <span>Favorited</span> : null}
                  </>
                ) : null}

                {mode === "favorites" ? (
                  <>
                    <span>User Plays: {compactNumber(row.userPlayCount || 0)}</span>
                    <span>Global Plays: {compactNumber(row.globalPlayCount || 0)}</span>
                    <span>Favorited: {formatShortDate(row.favoritedAt)}</span>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div style={emptyStateStyle}>{text}</div>;
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background:
    "radial-gradient(circle at top, rgba(255,255,255,0.06), transparent 30%), linear-gradient(180deg, #04070d 0%, #07111f 38%, #000 100%)",
  color: "white",
  padding: "28px 16px 120px",
  maxWidth: 1120,
  margin: "0 auto",
};

const heroShellStyle: React.CSSProperties = {
  position: "relative",
  overflow: "hidden",
  borderRadius: 32,
  padding: 22,
  marginBottom: 20,
  border: "1px solid rgba(255,255,255,0.12)",
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.12), rgba(255,255,255,0.04)), rgba(255,255,255,0.04)",
  backdropFilter: "blur(24px) saturate(150%)",
  WebkitBackdropFilter: "blur(24px) saturate(150%)",
  boxShadow:
    "0 24px 50px rgba(0,0,0,0.26), inset 0 1px 0 rgba(255,255,255,0.08)",
};

const heroGlowOne: React.CSSProperties = {
  position: "absolute",
  right: -40,
  top: -50,
  width: 220,
  height: 220,
  borderRadius: "999px",
  background: "radial-gradient(circle, rgba(120,180,255,0.26), rgba(120,180,255,0))",
  filter: "blur(10px)",
  pointerEvents: "none",
};

const heroGlowTwo: React.CSSProperties = {
  position: "absolute",
  left: -30,
  bottom: -40,
  width: 180,
  height: 180,
  borderRadius: "999px",
  background: "radial-gradient(circle, rgba(255,255,255,0.12), rgba(255,255,255,0))",
  filter: "blur(10px)",
  pointerEvents: "none",
};

const heroTopRowStyle: React.CSSProperties = {
  position: "relative",
  zIndex: 1,
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  alignItems: "flex-start",
  flexWrap: "wrap",
};

const eyebrowStyle: React.CSSProperties = {
  fontSize: 11,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "rgba(255,255,255,0.64)",
  marginBottom: 10,
};

const heroBadgeStyle: React.CSSProperties = {
  minWidth: 180,
  borderRadius: 20,
  padding: "14px 16px",
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.06)",
};

const heroBadgeLabelStyle: React.CSSProperties = {
  fontSize: 11,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "rgba(255,255,255,0.6)",
  marginBottom: 8,
};

const heroBadgeValueStyle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 700,
};

const backLinkStyle: React.CSSProperties = {
  display: "inline-block",
  marginBottom: 14,
  color: "rgba(255,255,255,0.82)",
  textDecoration: "none",
  position: "relative",
  zIndex: 1,
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 42,
  lineHeight: 0.95,
  letterSpacing: "-0.05em",
};

const subtitleStyle: React.CSSProperties = {
  marginTop: 12,
  maxWidth: 680,
  color: "rgba(255,255,255,0.76)",
  lineHeight: 1.6,
  fontSize: 15,
};

const topMetricsGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 12,
  marginBottom: 20,
};

const metricCardStyle: React.CSSProperties = {
  borderRadius: 22,
  border: "1px solid rgba(255,255,255,0.12)",
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.1), rgba(255,255,255,0.04)), rgba(255,255,255,0.04)",
  padding: 16,
  boxShadow: "0 16px 28px rgba(0,0,0,0.2)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
};

const metricLabelStyle: React.CSSProperties = {
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: "0.12em",
  color: "rgba(255,255,255,0.58)",
  marginBottom: 10,
};

const metricValueStyle: React.CSSProperties = {
  fontSize: 30,
  fontWeight: 800,
  letterSpacing: "-0.04em",
};

const featureGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: 12,
  marginBottom: 20,
};

const spotlightCardStyle: React.CSSProperties = {
  position: "relative",
  overflow: "hidden",
  borderRadius: 26,
  border: "1px solid rgba(255,255,255,0.12)",
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.12), rgba(255,255,255,0.04)), rgba(255,255,255,0.04)",
  padding: 18,
  boxShadow:
    "0 18px 34px rgba(0,0,0,0.24), inset 0 1px 0 rgba(255,255,255,0.08)",
};

const spotlightGlowStyle: React.CSSProperties = {
  position: "absolute",
  right: -30,
  top: -40,
  width: 140,
  height: 140,
  borderRadius: "999px",
  background: "radial-gradient(circle, rgba(143,197,255,0.22), rgba(143,197,255,0))",
  filter: "blur(10px)",
};

const spotlightLabelStyle: React.CSSProperties = {
  fontSize: 11,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "rgba(255,255,255,0.58)",
  marginBottom: 6,
};

const spotlightSubStyle: React.CSSProperties = {
  fontSize: 13,
  color: "rgba(255,255,255,0.72)",
  marginBottom: 14,
  lineHeight: 1.5,
};

const spotlightBodyStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "74px 1fr",
  gap: 14,
  alignItems: "center",
};

const spotlightCoverWrapStyle: React.CSSProperties = {
  width: 74,
  height: 74,
  borderRadius: 18,
  overflow: "hidden",
  background: "rgba(255,255,255,0.08)",
};

const spotlightCoverImageStyle: React.CSSProperties = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
};

const spotlightCoverFallbackStyle: React.CSSProperties = {
  width: "100%",
  height: "100%",
  display: "grid",
  placeItems: "center",
  background: "linear-gradient(145deg, #2b2b2b, #161616)",
  fontWeight: 800,
  fontSize: 28,
};

const spotlightSongTitleStyle: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 800,
  letterSpacing: "-0.03em",
};

const spotlightSongMetaStyle: React.CSSProperties = {
  marginTop: 4,
  color: "rgba(255,255,255,0.68)",
};

const spotlightStatStyle: React.CSSProperties = {
  marginTop: 12,
  display: "inline-flex",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
};

const spotlightStatLabelStyle: React.CSSProperties = {
  fontSize: 12,
  color: "rgba(255,255,255,0.6)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
};

const spotlightStatValueStyle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 800,
};

const spotlightStatValueTextStyle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 700,
};

const gridTwoStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
  gap: 12,
  marginBottom: 20,
};

const glassSectionStyle: React.CSSProperties = {
  borderRadius: 28,
  border: "1px solid rgba(255,255,255,0.12)",
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.1), rgba(255,255,255,0.04)), rgba(255,255,255,0.04)",
  padding: 18,
  boxShadow:
    "0 18px 34px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.08)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
};

const sectionTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 26,
  letterSpacing: "-0.04em",
};

const sectionSubtitleStyle: React.CSSProperties = {
  margin: "8px 0 0",
  color: "rgba(255,255,255,0.7)",
  lineHeight: 1.5,
  fontSize: 14,
};

const emptyStateStyle: React.CSSProperties = {
  borderRadius: 18,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.04)",
  padding: 16,
  color: "rgba(255,255,255,0.7)",
};

const rankRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "36px 1fr auto",
  gap: 12,
  alignItems: "center",
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.04)",
  padding: 12,
};

const rankNumberStyle: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: "999px",
  display: "grid",
  placeItems: "center",
  background: "rgba(255,255,255,0.08)",
  fontWeight: 800,
};

const rankBodyStyle: React.CSSProperties = {
  minWidth: 0,
};

const rankTitleStyle: React.CSSProperties = {
  fontWeight: 700,
  fontSize: 15,
};

const rankSubStyle: React.CSSProperties = {
  marginTop: 4,
  color: "rgba(255,255,255,0.68)",
  fontSize: 13,
  lineHeight: 1.45,
};

const rankPillStyle: React.CSSProperties = {
  borderRadius: 999,
  padding: "8px 10px",
  background: "rgba(255,255,255,0.08)",
  fontSize: 12,
  fontWeight: 700,
};

const miniRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.04)",
  padding: 12,
};

const miniRowTitleStyle: React.CSSProperties = {
  fontWeight: 700,
  fontSize: 15,
};

const miniRowSubStyle: React.CSSProperties = {
  marginTop: 4,
  color: "rgba(255,255,255,0.66)",
  fontSize: 13,
};

const miniPillStyle: React.CSSProperties = {
  borderRadius: 999,
  padding: "8px 10px",
  background: "rgba(255,255,255,0.08)",
  fontSize: 12,
  fontWeight: 700,
  whiteSpace: "nowrap",
};

const locationCardStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "42px 1fr",
  gap: 14,
  alignItems: "start",
  borderRadius: 18,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.04)",
  padding: 14,
};

const locationIconStyle: React.CSSProperties = {
  width: 42,
  height: 42,
  borderRadius: "999px",
  display: "grid",
  placeItems: "center",
  background: "rgba(255,255,255,0.08)",
  fontSize: 20,
};

const locationTitleStyle: React.CSSProperties = {
  fontWeight: 700,
  fontSize: 15,
};

const locationSubStyle: React.CSSProperties = {
  marginTop: 6,
  color: "rgba(255,255,255,0.68)",
  fontSize: 13,
  lineHeight: 1.55,
};

const rowCardStyle: React.CSSProperties = {
  borderRadius: 20,
  border: "1px solid rgba(255,255,255,0.1)",
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03)), rgba(255,255,255,0.03)",
  padding: 14,
  display: "grid",
  gridTemplateColumns: "72px 1fr",
  gap: 14,
  alignItems: "center",
};

const coverWrapStyle: React.CSSProperties = {
  width: 72,
  height: 72,
  borderRadius: 16,
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
  color: "rgba(255,255,255,0.9)",
  fontSize: 24,
  fontWeight: 700,
  background: "linear-gradient(145deg, #2b2b2b, #161616)",
};

const songTitleStyle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 800,
  letterSpacing: "-0.03em",
};

const songMetaStyle: React.CSSProperties = {
  color: "rgba(255,255,255,0.68)",
  marginTop: 4,
  lineHeight: 1.45,
};

const statsLineStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  marginTop: 10,
  color: "rgba(255,255,255,0.78)",
  fontSize: 13,
  lineHeight: 1.5,
};
