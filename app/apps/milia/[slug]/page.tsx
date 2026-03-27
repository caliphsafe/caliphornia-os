import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase-admin";
import styles from "../milia.module.css";

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
  location_note: string | null;
};

type WeatherData = {
  current: {
    temperature: number | null;
    apparentTemperature: number | null;
    humidity: number | null;
    windSpeed: number | null;
    label: string;
  };
  today: {
    tempMax: number | null;
    tempMin: number | null;
    label: string;
    sunrise: string | null;
    sunset: string | null;
  };
  hourly: Array<{
    time: string;
    temperature: number | null;
    label: string;
  }>;
  daily: Array<{
    time: string;
    label: string;
    tempMax: number | null;
    tempMin: number | null;
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

async function createSignedAudioUrl(storagePath: string | null | undefined) {
  if (!storagePath) return null;

  const { data, error } = await supabaseAdmin.storage
    .from("songs")
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

function formatDayLabel(value: string) {
  try {
    return new Date(value).toLocaleDateString("en-US", {
      weekday: "short",
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

  const baseUrl = getBaseUrl();

  const res = await fetch(
    `${baseUrl}/api/apps/milia/weather?${params.toString()}`,
    {
      next: { revalidate: 60 * 15 },
    }
  );

  if (!res.ok) return null;

  const data = await res.json();
  return data?.ok ? data.weather : null;
}

export default async function MiliaSongDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

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
      weather_sort_order,
      location_note
    `)
    .eq("source_app_slug", "milia")
    .eq("slug", slug)
    .maybeSingle();

  if (error || !data) {
    notFound();
  }

  const song = data as SongRow;

  let coverUrl: string | null = null;
  let audioUrl: string | null = null;
  let weather: WeatherData | null = null;

  try {
    [coverUrl, audioUrl, weather] = await Promise.all([
      createSignedCoverUrl(song.cover_image_path),
      createSignedAudioUrl(song.audio_path),
      getWeatherForSong(song),
    ]);
  } catch {
    coverUrl = await createSignedCoverUrl(song.cover_image_path);
    audioUrl = await createSignedAudioUrl(song.audio_path);
    weather = null;
  }

  const placeLabel =
    song.weather_location_name ||
    [song.weather_city, song.weather_region, song.weather_country]
      .filter(Boolean)
      .join(", ") ||
    song.weather_search_label ||
    "Unknown location";

  return (
    <main className={styles.page}>
      <div className={styles.chrome}>
        <Link href="/apps/milia" className={styles.backPill} aria-label="Back to Milia">
          ‹
        </Link>
        <div className={styles.titlePill}>Milia</div>
      </div>

      <div className={styles.container}>
        <section className={styles.detailHero}>
          <p className={styles.heroKicker}>{song.artist_name || "Unknown artist"}</p>
          <h1 className={styles.heroTitle}>{song.title}</h1>
          <p className={styles.detailPlace}>{placeLabel}</p>

          <div className={styles.detailWeather}>
            <div className={styles.detailNow}>
              {weather?.current?.temperature != null
                ? `${Math.round(weather.current.temperature)}°`
                : "—"}
            </div>

            <div className={styles.detailNowMeta}>
              <div>{weather?.current?.label || "Forecast unavailable"}</div>
              <div>
                H:{weather?.today?.tempMax != null ? Math.round(weather.today.tempMax) : "—"}°
                {"  "}
                L:{weather?.today?.tempMin != null ? Math.round(weather.today.tempMin) : "—"}°
              </div>
            </div>
          </div>
        </section>

        <div className={styles.detailGrid}>
          <section className={styles.panel}>
            <h2 className={styles.panelTitle}>Song</h2>

            <div className={styles.audioBlock}>
              <div className={styles.audioCover}>
                {coverUrl ? (
                  <img src={coverUrl} alt={song.title} />
                ) : (
                  <div className={styles.audioFallback}>♪</div>
                )}
              </div>

              {audioUrl ? (
                <audio controls className={styles.audioPlayer} src={audioUrl} />
              ) : null}

              <div className={styles.songMetaGrid}>
                <div className={styles.metaCell}>
                  <span className={styles.metaLabel}>Artist</span>
                  <span className={styles.metaValue}>{song.artist_name || "—"}</span>
                </div>
                <div className={styles.metaCell}>
                  <span className={styles.metaLabel}>Producers</span>
                  <span className={styles.metaValue}>{song.producer_names || "—"}</span>
                </div>
                <div className={styles.metaCell}>
                  <span className={styles.metaLabel}>Duration</span>
                  <span className={styles.metaValue}>{song.duration_label || "—"}</span>
                </div>
                <div className={styles.metaCell}>
                  <span className={styles.metaLabel}>Place</span>
                  <span className={styles.metaValue}>{placeLabel}</span>
                </div>
              </div>

              {song.description ? <p className={styles.note}>{song.description}</p> : null}
              {song.location_note ? <p className={styles.note}>{song.location_note}</p> : null}
            </div>
          </section>

          <section className={styles.panel}>
            <h2 className={styles.panelTitle}>Hourly</h2>
            <div className={styles.hourlyRow}>
              {(weather?.hourly || []).slice(0, 8).map((hour) => (
                <div key={hour.time} className={styles.hourChip}>
                  <div className={styles.hourTime}>{formatHourLabel(hour.time)}</div>
                  <div className={styles.hourTemp}>
                    {hour.temperature != null ? `${Math.round(hour.temperature)}°` : "—"}
                  </div>
                  <div className={styles.hourLabel}>{hour.label}</div>
                </div>
              ))}
            </div>
          </section>

          <section className={styles.panel}>
            <h2 className={styles.panelTitle}>7-Day Forecast</h2>
            <div className={styles.dayList}>
              {(weather?.daily || []).map((day) => (
                <div key={day.time} className={styles.dayRow}>
                  <div className={styles.dayName}>{formatDayLabel(day.time)}</div>
                  <div className={styles.dayLabel}>{day.label}</div>
                  <div className={styles.dayTemps}>
                    {day.tempMax != null ? Math.round(day.tempMax) : "—"}°
                    {" / "}
                    {day.tempMin != null ? Math.round(day.tempMin) : "—"}°
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className={styles.panel}>
            <h2 className={styles.panelTitle}>Weather Details</h2>
            <div className={styles.songMetaGrid}>
              <div className={styles.metaCell}>
                <span className={styles.metaLabel}>Feels Like</span>
                <span className={styles.metaValue}>
                  {weather?.current?.apparentTemperature != null
                    ? `${Math.round(weather.current.apparentTemperature)}°`
                    : "—"}
                </span>
              </div>
              <div className={styles.metaCell}>
                <span className={styles.metaLabel}>Humidity</span>
                <span className={styles.metaValue}>
                  {weather?.current?.humidity != null ? `${weather.current.humidity}%` : "—"}
                </span>
              </div>
              <div className={styles.metaCell}>
                <span className={styles.metaLabel}>Wind</span>
                <span className={styles.metaValue}>
                  {weather?.current?.windSpeed != null
                    ? `${Math.round(weather.current.windSpeed)} km/h`
                    : "—"}
                </span>
              </div>
              <div className={styles.metaCell}>
                <span className={styles.metaLabel}>Timezone</span>
                <span className={styles.metaValue}>{song.weather_timezone || "Auto"}</span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
