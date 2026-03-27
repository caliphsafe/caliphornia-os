import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase-admin";
import styles from "../milia.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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

function weatherCodeLabel(code: number | null | undefined) {
  const map: Record<number, string> = {
    0: "Clear",
    1: "Mostly Clear",
    2: "Partly Cloudy",
    3: "Cloudy",
    45: "Fog",
    48: "Fog",
    51: "Light Drizzle",
    53: "Drizzle",
    55: "Heavy Drizzle",
    61: "Light Rain",
    63: "Rain",
    65: "Heavy Rain",
    71: "Light Snow",
    73: "Snow",
    75: "Heavy Snow",
    80: "Light Showers",
    81: "Showers",
    82: "Heavy Showers",
    95: "Thunderstorm",
  };

  return map[code ?? -1] || "Forecast";
}

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
  if (song.weather_lat == null || song.weather_lng == null) {
    return null;
  }

  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(song.weather_lat));
  url.searchParams.set("longitude", String(song.weather_lng));
  url.searchParams.set("timezone", song.weather_timezone || "auto");
  url.searchParams.set(
    "current",
    "temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code"
  );
  url.searchParams.set(
    "hourly",
    "temperature_2m,weather_code"
  );
  url.searchParams.set(
    "daily",
    "weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset"
  );
  url.searchParams.set("forecast_days", "7");

  const res = await fetch(url.toString(), {
    cache: "no-store",
  });

  if (!res.ok) return null;

  const data = await res.json();
  const current = data?.current || {};
  const daily = data?.daily || {};
  const hourly = data?.hourly || {};

  return {
    current: {
      temperature: current?.temperature_2m ?? null,
      apparentTemperature: current?.apparent_temperature ?? null,
      humidity: current?.relative_humidity_2m ?? null,
      windSpeed: current?.wind_speed_10m ?? null,
      label: weatherCodeLabel(current?.weather_code),
    },
    today: {
      tempMax: daily?.temperature_2m_max?.[0] ?? null,
      tempMin: daily?.temperature_2m_min?.[0] ?? null,
      label: weatherCodeLabel(daily?.weather_code?.[0] ?? current?.weather_code),
      sunrise: daily?.sunrise?.[0] ?? null,
      sunset: daily?.sunset?.[0] ?? null,
    },
    hourly: Array.isArray(hourly?.time)
      ? hourly.time.slice(0, 8).map((time: string, index: number) => ({
          time,
          temperature: hourly?.temperature_2m?.[index] ?? null,
          label: weatherCodeLabel(hourly?.weather_code?.[index]),
        }))
      : [],
    daily: Array.isArray(daily?.time)
      ? daily.time.slice(0, 7).map((time: string, index: number) => ({
          time,
          label: weatherCodeLabel(daily?.weather_code?.[index]),
          tempMax: daily?.temperature_2m_max?.[index] ?? null,
          tempMin: daily?.temperature_2m_min?.[index] ?? null,
        }))
      : [],
  };
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
