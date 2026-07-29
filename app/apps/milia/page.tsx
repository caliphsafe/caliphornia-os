import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { verifySession } from "@/lib/session";
import { getSongPlaybackAccess } from "@/lib/access";
import MiliaSongCard from "@/components/MiliaSongCard";
import type { GlobalTrack } from "@/components/GlobalPlayer";
import styles from "./milia.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SongRow = {
  id: string;
  slug: string;
  title: string;
  artist_name: string | null;
  audio_path: string | null;
  preview_audio_path: string | null;
  preview_starts_at: number | null;
  preview_duration: number | null;
  release_at: string | null;
  early_access_at: string | null;
  is_locked: boolean | null;
  requires_project_access: boolean | null;
  requires_all_access: boolean | null;
  is_free_full_play: boolean | null;
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

type WeatherData = { current: { temperature: number | null; label: string }; today: { tempMax: number | null; tempMin: number | null; label: string } };

function weatherCodeLabel(code: number | null | undefined) {
  const map: Record<number, string> = {0:"Clear",1:"Mostly Clear",2:"Partly Cloudy",3:"Cloudy",45:"Fog",48:"Fog",51:"Light Drizzle",53:"Drizzle",55:"Heavy Drizzle",61:"Light Rain",63:"Rain",65:"Heavy Rain",71:"Light Snow",73:"Snow",75:"Heavy Snow",80:"Light Showers",81:"Showers",82:"Heavy Showers",95:"Thunderstorm"};
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

function placeLabel(song: SongRow) {
  return song.weather_location_name || [song.weather_city, song.weather_region, song.weather_country].filter(Boolean).join(", ") || song.weather_search_label || "Weather location";
}

async function getWeather(song: SongRow): Promise<WeatherData | null> {
  if (song.weather_lat == null || song.weather_lng == null) return null;
  try {
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", String(song.weather_lat));
    url.searchParams.set("longitude", String(song.weather_lng));
    url.searchParams.set("timezone", song.weather_timezone || "auto");
    url.searchParams.set("current", "temperature_2m,weather_code");
    url.searchParams.set("daily", "weather_code,temperature_2m_max,temperature_2m_min");
    url.searchParams.set("forecast_days", "1");
    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    return { current: { temperature: data?.current?.temperature_2m ?? null, label: weatherCodeLabel(data?.current?.weather_code) }, today: { tempMax: data?.daily?.temperature_2m_max?.[0] ?? null, tempMin: data?.daily?.temperature_2m_min?.[0] ?? null, label: weatherCodeLabel(data?.daily?.weather_code?.[0] ?? data?.current?.weather_code) } };
  } catch { return null; }
}

export default async function MiliaPage() {
  const cookieStore = await cookies();
  const session = verifySession(cookieStore.get("caliph_os_session")?.value ?? null);
  if (!session?.email) redirect("/");

  const { data } = await supabaseAdmin.from("songs").select(`id,slug,title,artist_name,audio_path,preview_audio_path,preview_starts_at,preview_duration,release_at,early_access_at,is_locked,requires_project_access,requires_all_access,is_free_full_play,duration_label,description,weather_location_name,weather_city,weather_region,weather_country,weather_lat,weather_lng,weather_timezone,weather_search_label,weather_sort_order`).eq("source_app_slug", "milia").order("weather_sort_order", { ascending: true, nullsFirst: false });
  const songs = (data || []) as SongRow[];
  const cards = await Promise.all(songs.map(async (song) => ({ song, weather: await getWeather(song), access: await getSongPlaybackAccess({ userEmail: session.email, projectSlug: "milia", song }) })));
  const queue: GlobalTrack[] = cards.map(({ song, access }) => ({ id: song.id, songId: song.id, slug: song.slug, songSlug: song.slug, title: song.title, artist: song.artist_name || "Caliph", displayTitle: song.title, duration: song.duration_label || undefined, description: access.lockedReason || song.description || undefined, playlistSongSlug: song.slug, analyticsSongSlug: song.slug, sourceApp: "milia", isPreview: access.isPreview, clipStartSeconds: access.clipStartSeconds, clipEndSeconds: access.clipEndSeconds }));

  return (
    <main className={styles.page}>
      <div className={styles.chrome}>
        <a href="/home" className={styles.backPill} aria-label="Back to home">‹</a>
        <a href="/apps/share" className={styles.morePill} aria-label="Share">⌁</a>
      </div>
      <section className={styles.container}>
        <div className={styles.hero}><h1 className={styles.heroTitle}>Milia</h1></div>
      </section>
      <section className={`${styles.container} ${styles.stack}`}>
        {cards.length ? cards.map(({ song, weather }, index) => (
          <MiliaSongCard key={song.id || song.slug} href={`/apps/milia/${song.slug}`} slug={song.slug} title={song.title} artistName={song.artist_name || "Caliph"} placeLabel={placeLabel(song)} weather={weather} themeClassName={getWeatherTheme(weather?.today?.label || weather?.current?.label)} queue={queue} startIndex={index} />
        )) : <section className={styles.card}><h2 className={styles.cardTitle}>Milia</h2><p className={styles.cardArtist}>Weather songs are ready when Milia songs are attached to this app.</p></section>}
      </section>
    </main>
  );
}
