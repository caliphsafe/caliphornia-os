"use client";

import { useEffect, useState } from "react";
import styles from "@/app/apps/milia/milia.module.css";
import type { GlobalTrack } from "@/components/GlobalPlayer";

function getCurrentTrackSlugFromPlayerState(data: any) {
  return data?.playlistSongSlug || data?.slug || null;
}

export default function MiliaDetailPlayer({
  slug,
  title,
  artistName,
  placeLabel,
  coverUrl,
  queue,
  startIndex,
}: {
  slug: string;
  title: string;
  artistName: string;
  placeLabel: string;
  coverUrl: string | null;
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

  function handlePlay() {
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
    <section className={styles.panel}>
      <h2 className={styles.panelTitle}>Now Playing</h2>

      <div className={styles.audioBlock}>
        <div className={styles.audioCover}>
          {coverUrl ? (
            <img src={coverUrl} alt={title} />
          ) : (
            <div className={styles.audioFallback}>♪</div>
          )}
        </div>

        <div className={styles.detailPlayerHeader}>
          <div>
            <div className={styles.detailPlayerTitle}>{title}</div>
            <div className={styles.detailPlayerSub}>
              {artistName} · {placeLabel}
            </div>
          </div>

          <button
            type="button"
            className={`${styles.detailPlayButton} ${isPlaying ? styles.detailPlayButtonActive : ""}`}
            onClick={handlePlay}
            aria-label={isPlaying ? `Pause ${title}` : `Play ${title}`}
          >
            {isPlaying ? "Pause" : "Play"}
          </button>
        </div>

        <p className={styles.detailPlayerHint}>
          Playback uses the universal global player and continues across apps.
        </p>
      </div>
    </section>
  );
}
