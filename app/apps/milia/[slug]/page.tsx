import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase-admin";
import MiliaDetailPlayer from "@/components/MiliaDetailPlayer";
import MiliaTrackSync from "@/components/MiliaTrackSync";
import type { GlobalTrack } from "@/components/GlobalPlayer";
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

function weatherGlyph(label?: string | null) {
  const value = String(label || "").toLowerCase();

  if (value.includes("thunder")) return "⚡";
  if (value.includes("rain") || value.includes("drizzle") || value.includes("showers")) return "☔";
  if (value.includes("cloud")) return "☁";
  if (value.includes("fog")) return "〰";
  if (value.includes("snow")) return "❄";
  if (value.includes("clear") || value.includes("sun")) return "☀";
  if (value.includes("partly")) return "⛅";
  return "☁";
}

function getWeatherTheme(label?: string | null) {
  const value = String(label || "").toLowerCase();

  if (value.includes("thunder")) return "detailStorm";
  if (value.includes("rain") || value.includes("drizzle") || value.includes("showers")) return "detailRain";
  if (value.includes("cloud") || value.includes("fog")) return "detailCloud";
  if (value.includes("clear") || value.includes("sun")) return "detailSun";
  return "detailBlue";
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
  url.searchParams.set("hourly", "temperature_2m,weather_code");
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
      ? hourly.time.slice(0, 6).map((time: string, index: number) => ({
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

function getTempBarRange(daily: WeatherData["daily"]) {
  const mins = daily.map((day) => day.tempMin).filter((v): v is number => v != null);
  const maxes = daily.map((day) => day.tempMax).filter((v): v is number => v != null);

  if (!mins.length || !maxes.length) {
    return { min: 0, max: 100 };
  }

  return {
    min: Math.min(...mins),
    max: Math.max(...maxes),
  };
}

function getBarStyle(
  minTemp: number | null,
  maxTemp: number | null,
  rangeMin: number,
  rangeMax: number
) {
  if (minTemp == null || maxTemp == null || rangeMax <= rangeMin) {
    return { left: "0%", width: "0%" };
  }

  const total = rangeMax - rangeMin;
  const left = ((minTemp - rangeMin) / total) * 100;
  const width = ((maxTemp - minTemp) / total) * 100;

  return {
    left: `${left}%`,
    width: `${Math.max(width, 8)}%`,
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

  const placeLabel =
    song.weather_location_name ||
    [song.weather_city, song.weather_region, song.weather_country]
      .filter(Boolean)
      .join(", ") ||
    song.weather_search_label ||
    "Unknown location";

  const [coverUrl, audioUrl, weather, queueRows] = await Promise.all([
    createSignedCoverUrl(song.cover_image_path),
    createSignedAudioUrl(song.audio_path),
    getWeatherForSong(song),
    supabaseAdmin
      .from("songs")
      .select(`
        slug,
        title,
        artist_name,
        audio_path,
        cover_image_path,
        weather_location_name,
        weather_city,
        weather_region,
        weather_country,
        weather_search_label,
        weather_sort_order
      `)
      .eq("source_app_slug", "milia")
      .order("weather_sort_order", { ascending: true, nullsFirst: false }),
  ]);

  const queueData = queueRows.data || [];

  const projectQueue: GlobalTrack[] = (
    await Promise.all(
      queueData.map(async (row) => {
        const [rowAudioUrl, rowCoverUrl] = await Promise.all([
          createSignedAudioUrl(row.audio_path),
          createSignedCoverUrl(row.cover_image_path),
        ]);

        if (!rowAudioUrl) return null;

        return {
          id: row.slug,
          slug: row.slug,
          title: row.title,
          artist: row.artist_name || "Unknown artist",
          displayTitle: row.title,
          file: rowAudioUrl,
          playlistSongSlug: row.slug,
          analyticsSongSlug: row.slug,
          sourceApp: "milia",
          coverUrl: rowCoverUrl || undefined,
        } satisfies GlobalTrack;
      })
    )
  ).filter(Boolean) as GlobalTrack[];

  const pageThemeClass = getWeatherTheme(weather?.today?.label || weather?.current?.label);
  const range = getTempBarRange(weather?.daily || []);

  return (
    <main className={`${styles.page} ${styles[pageThemeClass]}`}>
      <MiliaTrackSync currentSlug={song.slug} />

      <div className={styles.chrome}>
        <Link href="/apps/milia" className={styles.backPill} aria-label="Back to Milia">
          ‹
        </Link>

        <button type="button" className={styles.morePill} aria-label="More options">
          •••
        </button>
      </div>

      <div className={styles.container}>
        <section className={styles.detailHero}>
          <p className={styles.detailLocationKicker}>{placeLabel}</p>
          <h1 className={styles.detailCityTitle}>{song.title}</h1>

          <div className={styles.detailWeatherCenter}>
            <div className={styles.detailNow}>
              {weather?.current?.temperature != null
                ? `${Math.round(weather.current.temperature)}°`
                : "—"}
            </div>

            <div className={styles.detailConditionBlock}>
              <div className={styles.detailConditionText}>
                {weather?.current?.label || "Forecast unavailable"}
              </div>
              <div className={styles.detailRangeText}>
                H:{weather?.today?.tempMax != null ? Math.round(weather.today.tempMax) : "—"}°
                {"  "}
                L:{weather?.today?.tempMin != null ? Math.round(weather.today.tempMin) : "—"}°
              </div>
            </div>
          </div>
        </section>

        <div className={styles.detailGrid}>
          <section className={styles.panel}>
            <p className={styles.detailIntro}>
              {song.artist_name || "Unknown artist"} · Weather and music unfolding in {placeLabel}.
            </p>

            <div className={styles.hourlyForecastRow}>
              {(weather?.hourly || []).slice(0, 6).map((hour, index) => (
                <div key={hour.time} className={styles.forecastHourItem}>
                  <div className={styles.forecastHourTime}>
                    {index === 0 ? "Now" : formatHourLabel(hour.time)}
                  </div>
                  <div className={styles.forecastHourIcon}>{weatherGlyph(hour.label)}</div>
                  <div className={styles.forecastHourTemp}>
                    {hour.temperature != null ? `${Math.round(hour.temperature)}°` : "—"}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className={styles.panel}>
            <h2 className={styles.panelTitle}>10-Day Forecast</h2>
            <div className={styles.dayList}>
              {(weather?.daily || []).map((day, index) => {
                const barStyle = getBarStyle(day.tempMin, day.tempMax, range.min, range.max);

                return (
                  <div key={day.time} className={styles.weatherDayRow}>
                    <div className={styles.dayName}>
                      {index === 0 ? "Today" : formatDayLabel(day.time)}
                    </div>

                    <div className={styles.dayIcon}>{weatherGlyph(day.label)}</div>

                    <div className={styles.dayMin}>
                      {day.tempMin != null ? `${Math.round(day.tempMin)}°` : "—"}
                    </div>

                    <div className={styles.tempTrack}>
                      <span className={styles.tempTrackFill} style={barStyle} />
                    </div>

                    <div className={styles.dayMax}>
                      {day.tempMax != null ? `${Math.round(day.tempMax)}°` : "—"}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <MiliaDetailPlayer
            slug={song.slug}
            title={song.title}
            artistName={song.artist_name || "Unknown artist"}
            placeLabel={placeLabel}
            coverUrl={coverUrl}
            queue={projectQueue}
            startIndex={projectQueue.findIndex((track) => track.slug === song.slug)}
          />

          <section className={styles.panel}>
            <div className={styles.songMetaGrid}>
              <div className={styles.metaCell}>
                <span className={styles.metaLabel}>Artist</span>
                <span className={styles.metaValue}>{song.artist_name || "—"}</span>
              </div>
              <div className={styles.metaCell}>
                <span className={styles.metaLabel}>Producer</span>
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
          </section>
        </div>
      </div>
    </main>
  );
}
