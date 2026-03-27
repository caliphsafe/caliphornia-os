"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import styles from "@/app/apps/milia/milia.module.css";
import type { GlobalTrack } from "@/components/GlobalPlayer";

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

function getCurrentTrackSlugFromPlayerState(data: any) {
  return data?.playlistSongSlug || data?.slug || null;
}

export default function MiliaSongCard({
  href,
  slug,
  title,
  artistName,
  placeLabel,
  weather,
  themeClassName,
  queue,
  startIndex,
}: {
  href: string;
  slug: string;
  title: string;
  artistName: string;
  placeLabel: string;
  weather: WeatherData | null;
  themeClassName: string;
  queue: GlobalTrack[];
  startIndex: number;
}) {
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      const data = event.data;
      if (!data || typeof data !== "object") return;
      if (data.type !== "CALIPH_PLAYER_STATE") return;

      const activeSlug = getCurrentTrackSlugFromPlayerState(data);
      setIsPlaying(activeSlug === slug && Boolean(data.isPlaying));
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [slug]);

  function handlePlay(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    e.stopPropagation();

    window.postMessage(
      {
        type: "CALIPH_PLAYER_TOGGLE_TRACK",
        tracks: queue,
        startIndex,
      },
      "*"
    );
  }

  return (
    <Link
      href={href}
      className={`${styles.card} ${(styles as Record<string, string>)[themeClassName] || ""}`}
    >
      <div className={styles.cardTop}>
        <div className={styles.cardCopy}>
          <h2 className={styles.cardTitle}>{title}</h2>
          <p className={styles.cardArtist}>{artistName || "Unknown artist"}</p>
          <p className={styles.cardPlace}>{placeLabel}</p>
        </div>

        <div className={styles.cardTemp}>
          {weather?.current?.temperature != null
            ? `${Math.round(weather.current.temperature)}°`
            : "—"}
        </div>
      </div>

      <div className={styles.cardBottomMeta}>
        <div className={styles.cardCondition}>
          {weather?.today?.label || weather?.current?.label || "Forecast unavailable"}
        </div>

        <div className={styles.cardRange}>
          H:{weather?.today?.tempMax != null ? Math.round(weather.today.tempMax) : "—"}°
          {"  "}
          L:{weather?.today?.tempMin != null ? Math.round(weather.today.tempMin) : "—"}°
        </div>
      </div>

      <div className={styles.cardActions}>
        <button
          type="button"
          className={`${styles.cardPlayButton} ${isPlaying ? styles.cardPlayButtonActive : ""}`}
          onClick={handlePlay}
          aria-label={isPlaying ? `Pause ${title}` : `Play ${title}`}
        >
          <span className={styles.cardPlayGlyph}>{isPlaying ? "❚❚" : "▶"}</span>
        </button>
      </div>
    </Link>
  );
}
