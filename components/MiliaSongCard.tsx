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

type MiliaSongCardProps = {
  href: string;
  slug: string;
  title: string;
  artistName: string;
  placeLabel: string;
  weather: WeatherData | null;
  themeClassName: string;
  queue: GlobalTrack[];
  startIndex: number;
};

function getCurrentTrackSlugFromPlayerState(data: unknown) {
  if (!data || typeof data !== "object") return null;

  const state = data as {
    playlistSongSlug?: unknown;
    slug?: unknown;
  };

  if (typeof state.playlistSongSlug === "string") {
    return state.playlistSongSlug;
  }

  return typeof state.slug === "string" ? state.slug : null;
}

function getBrowserLocation(): Promise<{
  latitude: number;
  longitude: number;
  accuracy: number;
}> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Location sharing is not supported by this browser."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
      },
      () => {
        reject(
          new Error(
            "Allow location access to start a nearby song share.",
          ),
        );
      },
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 30000,
      },
    );
  });
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
}: MiliaSongCardProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [shareState, setShareState] = useState("");

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      const data = event.data;

      if (
        !data ||
        typeof data !== "object" ||
        (data as { type?: unknown }).type !== "CALIPH_PLAYER_STATE"
      ) {
        return;
      }

      const activeSlug = getCurrentTrackSlugFromPlayerState(data);
      setIsPlaying(activeSlug === slug && Boolean((data as { isPlaying?: unknown }).isPlaying));
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [slug]);

  function handlePlay(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();

    window.postMessage(
      {
        type: "CALIPH_PLAYER_TOGGLE_TRACK",
        tracks: queue,
        startIndex,
      },
      "*",
    );
  }

  async function handleShare(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();

    const track: GlobalTrack =
      queue[startIndex] || {
        title,
        slug,
      };

    setShareState("...");

    try {
      const location = await getBrowserLocation();

      const response = await fetch("/api/share/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          shareScope: "song",
          // songs.id is the canonical database identifier.
          songId: track.id || track.songId || null,
          songSlug: track.songSlug || track.slug || slug,
          location,
        }),
      });

      const result = await response
        .json()
        .catch(() => ({ ok: false, error: "Could not start Share." }));

      setShareState(result.ok ? "Live" : "!");

      if (!result.ok) {
        console.error(result.error || "Could not start Share.");
      }
    } catch (error) {
      setShareState("!");
      console.error(
        error instanceof Error ? error.message : "Could not start Share.",
      );
    }
  }

  return (
    <Link
      href={href}
      className={`${styles.card} ${
        (styles as Record<string, string>)[themeClassName] || ""
      }`}
    >
      <div className={styles.cardTop}>
        <div className={styles.cardCopy}>
          <h2 className={styles.cardTitle}>{title}</h2>
          <p className={styles.cardArtist}>
            {artistName || "Unknown artist"}
          </p>
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
          {weather?.today?.label ||
            weather?.current?.label ||
            "Forecast unavailable"}
        </div>

        <div className={styles.cardRange}>
          H:
          {weather?.today?.tempMax != null
            ? Math.round(weather.today.tempMax)
            : "—"}
          °{"  "}L:
          {weather?.today?.tempMin != null
            ? Math.round(weather.today.tempMin)
            : "—"}
          °
        </div>
      </div>

      <div className={styles.cardActions}>
        <button
          type="button"
          className={`${styles.cardPlayButton} ${
            isPlaying ? styles.cardPlayButtonActive : ""
          }`}
          onClick={handlePlay}
          aria-label={isPlaying ? `Pause ${title}` : `Play ${title}`}
        >
          <span className={styles.cardPlayGlyph}>
            {isPlaying ? "❚❚" : "▶"}
          </span>
        </button>

        <button
          type="button"
          className={styles.cardPlayButton}
          onClick={handleShare}
          aria-label={`Share ${title}`}
        >
          <span className={styles.cardPlayGlyph}>
            {shareState || "⌁"}
          </span>
        </button>
      </div>
    </Link>
  );
}
