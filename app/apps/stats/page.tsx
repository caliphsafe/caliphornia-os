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
      `)
  ]);

  if (globalStatsRes.error || userStatsRes.error || favoritesRes.error || songsRes.error) {
    return (
      <main style={pageStyle}>
        <a href="/home" style={backLinkStyle}>← Home</a>
        <h1 style={titleStyle}>Stats</h1>
        <p style={subtitleStyle}>Could not load stats.</p>
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

  const globalSongs = await Promise.all(
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
        isFavorite: favoriteSlugSet.has(row.song_slug)
      };
    })
  );

  const userSongs = await Promise.all(
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
        isFavorite: favoriteSlugSet.has(row.song_slug)
      };
    })
  );

  const favoriteSongs = await Promise.all(
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
        globalPlayCount: globalStat?.play_count || 0
      };
    })
  );

  globalSongs.sort((a, b) => b.playCount - a.playCount);
  userSongs.sort((a, b) => (b.lastPlayedAt || "").localeCompare(a.lastPlayedAt || ""));
  favoriteSongs.sort((a, b) => (b.favoritedAt || "").localeCompare(a.favoritedAt || ""));

  const totals = {
    totalUserPlayedSongs: userSongs.length,
    totalFavoriteSongs: favoriteSongs.length,
    totalUserPlays: userSongs.reduce((sum, row) => sum + (row.playCount || 0), 0)
  };

  return (
    <main style={pageStyle}>
      <div style={{ marginBottom: 24 }}>
        <a href="/home" style={backLinkStyle}>← Home</a>
        <h1 style={titleStyle}>Stats</h1>
        <p style={subtitleStyle}>
          Track overall song performance, your listening activity, and your favorite songs.
        </p>
      </div>

      <section style={totalsGridStyle}>
        <div style={cardStyle}>
          <div style={labelStyle}>Your Played Songs</div>
          <div style={valueStyle}>{totals.totalUserPlayedSongs}</div>
        </div>
        <div style={cardStyle}>
          <div style={labelStyle}>Your Favorites</div>
          <div style={valueStyle}>{totals.totalFavoriteSongs}</div>
        </div>
        <div style={cardStyle}>
          <div style={labelStyle}>Your Total Plays</div>
          <div style={valueStyle}>{totals.totalUserPlays}</div>
        </div>
      </section>

      <StatsSection title="Top Global Songs" rows={globalSongs} mode="global" />
      <StatsSection title="Your Song Activity" rows={userSongs} mode="user" />
      <StatsSection title="Your Favorite Songs" rows={favoriteSongs} mode="favorites" />
    </main>
  );
}

function StatsSection({
  title,
  rows,
  mode
}: {
  title: string;
  rows: any[];
  mode: "global" | "user" | "favorites";
}) {
  return (
    <section style={{ marginBottom: 32 }}>
      <h2 style={sectionTitleStyle}>{title}</h2>

      <div style={{ display: "grid", gap: 12 }}>
        {rows.length === 0 ? (
          <div style={cardStyle}>No data yet.</div>
        ) : (
          rows.map((row) => (
            <div
              key={`${mode}-${row.songSlug}`}
              style={rowCardStyle}
            >
              <div style={coverWrapStyle}>
                {row.coverImageUrl ? (
                  <img
                    src={row.coverImageUrl}
                    alt={row.title}
                    style={coverImageStyle}
                  />
                ) : (
                  <div style={coverFallbackStyle}>
                    <span>{String(row.title || "?").slice(0, 1).toUpperCase()}</span>
                  </div>
                )}
              </div>

              <div>
                <div style={songTitleStyle}>{row.title}</div>
                <div style={songMetaStyle}>{row.artistName || "Unknown artist"}</div>

                <div style={statsLineStyle}>
                  {mode === "global" ? (
                    <>
                      <span>Plays: {row.playCount}</span>
                      <span>Listeners: {row.uniqueListenerCount}</span>
                    </>
                  ) : null}

                  {mode === "user" ? (
                    <>
                      <span>Plays: {row.playCount}</span>
                      <span>
                        Last Played:{" "}
                        {row.lastPlayedAt ? new Date(row.lastPlayedAt).toLocaleString() : "—"}
                      </span>
                    </>
                  ) : null}

                  {mode === "favorites" ? (
                    <>
                      <span>User Plays: {row.userPlayCount}</span>
                      <span>Global Plays: {row.globalPlayCount}</span>
                    </>
                  ) : null}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "#000",
  color: "white",
  padding: "32px 18px 120px",
  maxWidth: 920,
  margin: "0 auto"
};

const backLinkStyle: React.CSSProperties = {
  display: "inline-block",
  marginBottom: 12,
  color: "rgba(255,255,255,0.8)",
  textDecoration: "none"
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 36,
  letterSpacing: "-0.04em"
};

const subtitleStyle: React.CSSProperties = {
  marginTop: 10,
  color: "rgba(255,255,255,0.72)",
  lineHeight: 1.5
};

const totalsGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 12,
  marginBottom: 28
};

const cardStyle: React.CSSProperties = {
  borderRadius: 20,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.05)",
  padding: 16
};

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "rgba(255,255,255,0.6)",
  marginBottom: 8
};

const valueStyle: React.CSSProperties = {
  fontSize: 28,
  fontWeight: 700
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 24,
  letterSpacing: "-0.03em",
  marginBottom: 14
};

const rowCardStyle: React.CSSProperties = {
  ...cardStyle,
  display: "grid",
  gridTemplateColumns: "64px 1fr",
  gap: 14,
  alignItems: "center"
};

const coverWrapStyle: React.CSSProperties = {
  width: 64,
  height: 64,
  borderRadius: 14,
  overflow: "hidden",
  background: "rgba(255,255,255,0.08)"
};

const coverImageStyle: React.CSSProperties = {
  width: "100%",
  height: "100%",
  objectFit: "cover"
};

const coverFallbackStyle: React.CSSProperties = {
  width: "100%",
  height: "100%",
  display: "grid",
  placeItems: "center",
  color: "rgba(255,255,255,0.9)",
  fontSize: 24,
  fontWeight: 700,
  background: "linear-gradient(145deg, #2b2b2b, #161616)"
};

const songTitleStyle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 700
};

const songMetaStyle: React.CSSProperties = {
  color: "rgba(255,255,255,0.68)",
  marginTop: 4
};

const statsLineStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  marginTop: 10,
  color: "rgba(255,255,255,0.75)",
  fontSize: 13
};
