"use client";

import { useEffect, useState } from "react";
import styles from "@/app/apps/milia/milia.module.css";
import {
  playMiliaQueue,
  subscribeMiliaPlayer,
  type MiliaQueueItem,
} from "@/lib/milia-player";

export default function MiliaDetailPlayer({
  slug,
  title,
  artistName,
  placeLabel,
  audioUrl,
  coverUrl,
  projectQueue,
}: {
  slug: string;
  title: string;
  artistName: string;
  placeLabel: string;
  audioUrl: string | null;
  coverUrl: string | null;
  projectQueue: MiliaQueueItem[];
}) {
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    return subscribeMiliaPlayer((state) => {
      setIsPlaying(state.currentSlug === slug && state.isPlaying);
    });
  }, [slug]);

  async function handlePlay() {
    await playMiliaQueue(projectQueue, slug);
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
            disabled={!audioUrl}
            aria-label={isPlaying ? `Pause ${title}` : `Play ${title}`}
          >
            {isPlaying ? "Pause" : "Play"}
          </button>
        </div>

        <p className={styles.detailPlayerHint}>
          Playback uses the project queue and continues as you move around the app.
        </p>
      </div>
    </section>
  );
}
