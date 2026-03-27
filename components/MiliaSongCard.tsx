"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import styles from "@/app/apps/milia/milia.module.css";
import {
  playMiliaQueue,
  subscribeMiliaPlayer,
  type MiliaQueueItem,
} from "@/lib/milia-player";

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

export default function MiliaSongCard({
  href,
  slug,
  title,
  artistName,
  placeLabel,
  audioUrl,
  weather,
  themeClassName,
  projectQueue,
}: {
  href: string;
  slug: string;
  title: string;
  artistName: string;
  placeLabel: string;
  audioUrl: string | null;
  weather: WeatherData | null;
  themeClassName: string;
  projectQueue: MiliaQueueItem[];
}) {
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    return subscribeMiliaPlayer((state) => {
      setIsPlaying(state.currentSlug === slug && state.isPlaying);
    });
  }, [slug]);

  async function handlePlay(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    e.stopPropagation();
    await playMiliaQueue(projectQueue, slug);
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
          disabled={!audioUrl}
          aria-label={isPlaying ? `Pause ${title}` : `Play ${title}`}
        >
          <span className={styles.cardPlayGlyph}>{isPlaying ? "❚❚" : "▶"}</span>
        </button>
      </div>
    </Link>
  );
}
