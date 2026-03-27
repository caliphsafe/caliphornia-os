import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase-admin";
import MiliaSongCard from "@/components/MiliaSongCard";
import type { GlobalTrack } from "@/components/GlobalPlayer";
import styles from "./milia.module.css";

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

function getWeatherTheme(label?: string | null) {
  const value = String(label || "").toLowerCase();

  if (value.includes("thunder")) return "cardStorm";
  if (value.includes("rain") || value.includes("drizzle") || value.includes("showers")) return "cardRain";
  if (value.includes("cloud") || value.includes("fog")) return "cardCloud";
  if (value.includes("clear") || value.includes("sun")) return "cardSun";
  return "cardBlue";
}

async function createSignedAudioUrl(storagePath: string | null | undefined) {
  if (!storagePath) return null;

  const { data, error } = await supabaseAdmin.storage
    .from("songs")
    .createSignedUrl(storagePath, 60 * 60);

  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

async function createSignedCoverUrl(storagePath: string | null | undefined) {
  if (!storagePath) return null;

  const { data, error } = await supabaseAdmin.storage
    .from("cover-art")
    .createSignedUrl(storagePath, 60 * 60);

  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

async function getWeatherForSong(song: SongRow): Promise<WeatherData | null> {
  if (song.weather_lat == null || song.weather_lng == null) {
    return null;
  }

  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(song.weather_lat));
  url.searchParams.set("longitude", String(song.weather_lng));
  url.searchParams.set("timezone", song.weather_timezone || "auto");
  url.searchParams.set("current", "temperature_2m,weather_code");
  url.searchParams.set("daily", "weather_code,temperature_2m_max,temperature_2m_min");
  url.searchParams.set("forecast_days", "1");

  const res = await fetch(url.toString(), {
    cache: "no-store",
  });

  if (!res.ok) return null;

  const data = await res.json();
  const current = data?.current || {};
  const daily = data?.daily || {};

  return {
    current: {
      temperature: current?.temperature_2m ?? null,
      label: weatherCodeLabel(current?.weather_code),
    },
    today: {
      tempMax: daily?.temperature_2m_max?.[0] ?? null,
      tempMin: daily?.temperature_2m_min?.[0] ?? null,
      label: weatherCodeLabel(daily?.weather_code?.[0] ?? current?.weather_code),
    },
  };
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

  const songsWithMeta = await Promise.all(
    songs.map(async (song) => {
      const placeLabel =
        song.weather_location_name ||
        [song.weather_city, song.weather_region, song.weather_country]
          .filter(Boolean)
          .join(", ") ||
        song.weather_search_label ||
        "Unknown location";

      try {
        const [weather, audioUrl, coverUrl] = await Promise.all([
          getWeatherForSong(song),
          createSignedAudioUrl(song.audio_path),
          createSignedCoverUrl(song.cover_image_path),
        ]);

        return {
          song,
          weather,
          audioUrl,
          coverUrl,
          placeLabel,
        };
      } catch {
        return {
          song,
          weather: null,
          audioUrl: null,
          coverUrl: null,
          placeLabel,
        };
      }
    })
  );

  const projectQueue: GlobalTrack[] = songsWithMeta
    .filter(({ audioUrl }) => Boolean(audioUrl))
    .map(({ song, audioUrl, coverUrl }) => ({
      id: song.slug,
      slug: song.slug,
      title: song.title,
      artist: song.artist_name || "Unknown artist",
      displayTitle: song.title,
      duration: song.duration_label || undefined,
      description: song.description || undefined,
      file: audioUrl as string,
      playlistSongSlug: song.slug,
      analyticsSongSlug: song.slug,
      sourceApp: "milia",
      coverUrl: coverUrl || undefined,
    }));

  return (
    <main className={styles.page}>
      <div className={styles.chrome}>
        <Link href="/home" className={styles.backPill} aria-label="Back to Home">
          ‹
        </Link>

        <button type="button" className={styles.morePill} aria-label="More options">
          •••
        </button>
      </div>

      <div className={styles.container}>
        <section className={styles.hero}>
          <h1 className={styles.heroTitle}>Milia</h1>
        </section>

        <section className={styles.stack}>
          {songsWithMeta.length === 0 ? (
            <div className={styles.empty}>No Milia songs yet.</div>
          ) : (
            songsWithMeta.map(({ song, weather, audioUrl, placeLabel }) => (
              <MiliaSongCard
                key={song.slug}
                href={`/apps/milia/${song.slug}`}
                slug={song.slug}
                title={song.title}
                artistName={song.artist_name || "Unknown artist"}
                placeLabel={placeLabel}
                audioUrl={audioUrl}
                weather={weather}
                themeClassName={getWeatherTheme(weather?.today?.label || weather?.current?.label)}
                queue={projectQueue}
                startIndex={projectQueue.findIndex((track) => track.slug === song.slug)}
              />
            ))
          )}
        </section>
      </div>
    </main>
  );
}
