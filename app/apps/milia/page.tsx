import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase-admin";
import styles from "./milia.module.css";
function getBaseUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL;
  }

  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return "http://localhost:3000";
}
type SongRow = {
  slug: string;
  title: string;
  artist_name: string | null;
  producer_names: string | null;
  cover_image_path: string | null;
  audio_path: string | null;
  duration_label: string | null;
  description: string | null;
  weather_location_name: string | null;
  weather_city: string | null;
  weather_region: string | null;
  weather_country: string | null;
  weather_lat: number | null;
  weather_lng: number | null;
  weather_timezone: string | null;
  weather_search_label: string | null;
  weather_sort_order: number | null;
};

type WeatherData = {
  current: {
    temperature: number | null;
    label: string;
  };
  today: {
    tempMax: number | null;
    tempMin: number | null;
    label: string;
  };
  hourly: Array<{
    time: string;
    temperature: number | null;
    label: string;
  }>;
};

async function createSignedCoverUrl(storagePath: string | null | undefined) {
  if (!storagePath) return null;

  const { data, error } = await supabaseAdmin.storage
    .from("cover-art")
    .createSignedUrl(storagePath, 60 * 60);

  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

function formatHourLabel(value: string) {
  try {
    return new Date(value).toLocaleTimeString("en-US", {
      hour: "numeric",
    });
  } catch {
    return value;
  }
}

async function getWeatherForSong(song: SongRow): Promise<WeatherData | null> {
  const params = new URLSearchParams();

  if (song.weather_lat != null && song.weather_lng != null) {
    params.set("lat", String(song.weather_lat));
    params.set("lng", String(song.weather_lng));
  } else if (song.weather_search_label) {
    params.set("search", song.weather_search_label);
  } else {
    return null;
  }

  if (song.weather_timezone) {
    params.set("timezone", song.weather_timezone);
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.startsWith("http")
      ? process.env.VERCEL_PROJECT_PRODUCTION_URL
      : process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "http://localhost:3000";

  const res = await fetch(`${baseUrl}/api/apps/milia/weather?${params.toString()}`, {
    next: { revalidate: 60 * 15 },
  });

  if (!res.ok) return null;

  const data = await res.json();
  return data?.ok ? data.weather : null;
}

export default async function MiliaPage() {
  const { data, error } = await supabaseAdmin
    .from("songs")
    .select(`
      slug,
      title,
      artist_name,
      producer_names,
      cover_image_path,
      audio_path,
      duration_label,
      description,
      weather_location_name,
      weather_city,
      weather_region,
      weather_country,
      weather_lat,
      weather_lng,
      weather_timezone,
      weather_search_label,
      weather_sort_order
    `)
    .eq("source_app_slug", "milia")
    .order("weather_sort_order", { ascending: true, nullsFirst: false });

  if (error) {
    return (
      <main className={styles.page}>
        <div className={styles.container}>
          <div className={styles.empty}>Could not load Milia songs.</div>
        </div>
      </main>
    );
  }

  const songs = (data || []) as SongRow[];

  const songsWithWeather = await Promise.all(
    songs.map(async (song) => ({
      song,
      coverUrl: await createSignedCoverUrl(song.cover_image_path),
      weather: await getWeatherForSong(song),
    }))
  );

  return (
    <main className={styles.page}>
      <div className={styles.chrome}>
        <Link href="/home" className={styles.backPill} aria-label="Back to Home">
          ‹
        </Link>
        <div className={styles.titlePill}>Milia</div>
      </div>

      <div className={styles.container}>
        <section className={styles.hero}>
          <p className={styles.heroKicker}>Weather songs</p>
          <h1 className={styles.heroTitle}>Songs tied to real places</h1>
          <p className={styles.heroSub}>
            Tap any song to open its place, current weather, forecast, and track details.
          </p>
        </section>

        <section className={styles.stack}>
          {songsWithWeather.length === 0 ? (
            <div className={styles.empty}>No Milia songs yet.</div>
          ) : (
            songsWithWeather.map(({ song, weather }) => (
              <Link key={song.slug} href={`/apps/milia/${song.slug}`} className={styles.card}>
                <div className={styles.cardTop}>
                  <div>
                    <h2 className={styles.cardTitle}>{song.title}</h2>
                    <p className={styles.cardArtist}>{song.artist_name || "Unknown artist"}</p>
                  </div>

                  <div className={styles.cardTemp}>
                    {weather?.current?.temperature != null
                      ? `${Math.round(weather.current.temperature)}°`
                      : "—"}
                  </div>
                </div>

                <div className={styles.cardMeta}>
                  <div className={styles.cardCondition}>
                    {weather?.today?.label || weather?.current?.label || "Forecast unavailable"}
                  </div>
                  <div className={styles.cardRange}>
                    H:{weather?.today?.tempMax != null ? Math.round(weather.today.tempMax) : "—"}°
                    {"  "}
                    L:{weather?.today?.tempMin != null ? Math.round(weather.today.tempMin) : "—"}°
                  </div>
                </div>

                {weather?.hourly?.length ? (
                  <>
                    <div className={styles.cardDivider} />
                    <div className={styles.hourlyRow}>
                      {weather.hourly.slice(0, 4).map((hour) => (
                        <div key={hour.time} className={styles.hourChip}>
                          <div className={styles.hourTime}>{formatHourLabel(hour.time)}</div>
                          <div className={styles.hourTemp}>
                            {hour.temperature != null ? `${Math.round(hour.temperature)}°` : "—"}
                          </div>
                          <div className={styles.hourLabel}>{hour.label}</div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : null}
              </Link>
            ))
          )}
        </section>
      </div>
    </main>
  );
}
