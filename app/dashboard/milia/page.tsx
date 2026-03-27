import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase-admin";

export default async function DashboardMiliaPage() {
  const { data, error } = await supabaseAdmin
    .from("songs")
    .select(`
      slug,
      title,
      artist_name,
      weather_location_name,
      weather_city,
      weather_country,
      weather_sort_order,
      audio_path
    `)
    .eq("source_app_slug", "milia")
    .order("weather_sort_order", { ascending: true, nullsFirst: false });

  return (
    <main style={pageStyle}>
      <div style={headerRowStyle}>
        <div>
          <p style={eyebrowStyle}>Dashboard</p>
          <h1 style={titleStyle}>Milia Songs</h1>
          <p style={subStyle}>
            Manage location-based weather songs for Milia.
          </p>
        </div>

        <Link href="/dashboard/import-song" style={buttonStyle}>
          Import Song
        </Link>
      </div>

      {error ? (
        <div style={cardStyle}>Could not load Milia songs.</div>
      ) : !data?.length ? (
        <div style={cardStyle}>No Milia songs yet.</div>
      ) : (
        <div style={listStyle}>
          {data.map((song) => {
            const place =
              song.weather_location_name ||
              [song.weather_city, song.weather_country]
                .filter(Boolean)
                .join(", ") ||
              "No place set";

            return (
              <div key={song.slug} style={cardStyle}>
                <div style={rowTopStyle}>
                  <div>
                    <div style={songTitleStyle}>{song.title}</div>
                    <div style={songSubStyle}>
                      {song.artist_name || "Unknown artist"}
                    </div>
                    <div style={placeStyle}>{place}</div>
                  </div>

                  <div style={sortBadgeStyle}>
                    #{song.weather_sort_order ?? "—"}
                  </div>
                </div>

                <div style={pathStyle}>{song.audio_path}</div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "#000",
  color: "white",
  padding: "28px 18px 120px",
};

const headerRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-end",
  gap: 16,
  marginBottom: 24,
  flexWrap: "wrap",
};

const eyebrowStyle: React.CSSProperties = {
  margin: 0,
  color: "rgba(255,255,255,0.64)",
  fontSize: 13,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
};

const titleStyle: React.CSSProperties = {
  margin: "6px 0 8px",
  fontSize: 38,
  letterSpacing: "-0.04em",
};

const subStyle: React.CSSProperties = {
  margin: 0,
  color: "rgba(255,255,255,0.72)",
  maxWidth: 560,
  lineHeight: 1.5,
};

const buttonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 44,
  padding: "0 16px",
  borderRadius: 999,
  background: "white",
  color: "black",
  textDecoration: "none",
  fontWeight: 700,
};

const listStyle: React.CSSProperties = {
  display: "grid",
  gap: 14,
};

const cardStyle: React.CSSProperties = {
  borderRadius: 20,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.04)",
  padding: 16,
};

const rowTopStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 12,
};

const songTitleStyle: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 700,
  letterSpacing: "-0.03em",
};

const songSubStyle: React.CSSProperties = {
  marginTop: 4,
  color: "rgba(255,255,255,0.72)",
};

const placeStyle: React.CSSProperties = {
  marginTop: 8,
  color: "rgba(255,255,255,0.88)",
  fontSize: 14,
};

const sortBadgeStyle: React.CSSProperties = {
  minWidth: 42,
  height: 32,
  borderRadius: 999,
  display: "grid",
  placeItems: "center",
  background: "rgba(255,255,255,0.08)",
  border: "1px solid rgba(255,255,255,0.12)",
  fontWeight: 700,
};

const pathStyle: React.CSSProperties = {
  marginTop: 12,
  color: "rgba(255,255,255,0.56)",
  fontSize: 13,
  wordBreak: "break-all",
};
