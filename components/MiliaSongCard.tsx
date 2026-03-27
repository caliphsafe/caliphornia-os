"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import styles from "@/app/apps/milia/milia.module.css";

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

let activeAudio: HTMLAudioElement | null = null;
let activeAudioId: string | null = null;
const listeners = new Set<(id: string | null) => void>();

function notifyActiveAudioChange() {
  for (const listener of listeners) {
    listener(activeAudioId);
  }
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

export default function MiliaSongCard({
  href,
  slug,
  title,
  artistName,
  placeLabel,
  audioUrl,
  weather,
  themeClassName,
}: {
  href: string;
  slug: string;
  title: string;
  artistName: string;
  placeLabel: string;
  audioUrl: string | null;
  weather: WeatherData | null;
  themeClassName: string;
}) {
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const sync = (id: string | null) => {
      setIsPlaying(id === slug);
    };

    listeners.add(sync);
    sync(activeAudioId);

    return () => {
      listeners.delete(sync);
    };
  }, [slug]);

  async function handlePlayToggle(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    e.stopPropagation();

    if (!audioUrl) return;

    if (activeAudio && activeAudioId === slug) {
      if (!activeAudio.paused) {
        activeAudio.pause();
        activeAudioId = null;
        notifyActiveAudioChange();
        return;
      }

      try {
        await activeAudio.play();
        activeAudioId = slug;
        notifyActiveAudioChange();
      } catch {}
      return;
    }

    if (activeAudio) {
      activeAudio.pause();
      activeAudio.currentTime = 0;
    }

    const nextAudio = new Audio(audioUrl);
    activeAudio = nextAudio;
    activeAudioId = slug;
    notifyActiveAudioChange();

    nextAudio.addEventListener("ended", () => {
      if (activeAudioId === slug) {
        activeAudioId = null;
        notifyActiveAudioChange();
      }
    });

    try {
      await nextAudio.play();
    } catch {
      activeAudioId = null;
      notifyActiveAudioChange();
    }
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

      <div className={styles.cardFooter}>
        <button
          type="button"
          className={`${styles.playPill} ${isPlaying ? styles.playPillActive : ""}`}
          onClick={handlePlayToggle}
          disabled={!audioUrl}
          aria-label={isPlaying ? `Pause ${title}` : `Play ${title}`}
        >
          <span className={styles.playGlyph}>{isPlaying ? "❚❚" : "▶"}</span>
          <span>{isPlaying ? "Pause" : "Play"}</span>
        </button>

        <span className={styles.openHint}>Open</span>
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
  );
}
