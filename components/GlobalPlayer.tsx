"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import styles from "./GlobalPlayer.module.css";

export type GlobalTrack = {
  id?: string | null;
  songId?: string | null;
  slug?: string | null;
  songSlug?: string | null;
  title: string;
  artist?: string | null;
  displayTitle?: string | null;
  file?: string | null;
  playbackUrl?: string | null;
  clipId?: string | null;
  clipStartSeconds?: number | null;
  clipEndSeconds?: number | null;
  playlistSongSlug?: string | null;
  analyticsSongSlug?: string | null;
  sourceApp?: string | null;
  isPreview?: boolean | null;
  coverUrl?: string | null;
  [key: string]: unknown;
};

type Props = {
  email: string;
};

type PersistedPlayer = {
  queue: GlobalTrack[];
  currentIndex: number;
};

const STORAGE_KEY = "caliphornia-global-player-v2";

function looksLikeUuid(value?: string | null) {
  return Boolean(
    value &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        value,
      ),
  );
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const minutes = Math.floor(seconds / 60);
  const remaining = Math.floor(seconds % 60);
  return `${minutes}:${String(remaining).padStart(2, "0")}`;
}

function trackIdentity(track: GlobalTrack | null) {
  if (!track) return "";
  return String(
    track.songId ||
      track.id ||
      track.songSlug ||
      track.playlistSongSlug ||
      track.analyticsSongSlug ||
      track.slug ||
      track.clipId ||
      "",
  );
}

function songIdFor(track: GlobalTrack | null) {
  if (!track) return null;
  if (track.songId) return String(track.songId);
  if (track.id && looksLikeUuid(String(track.id))) {
    return String(track.id);
  }
  return null;
}

function songSlugFor(track: GlobalTrack | null) {
  if (!track) return null;
  return (
    track.songSlug ||
    track.playlistSongSlug ||
    track.analyticsSongSlug ||
    track.slug ||
    null
  );
}

function IconStar({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="m12 3.6 2.58 5.23 5.77.84-4.18 4.07.99 5.75L12 16.78l-5.16 2.71.99-5.75-4.18-4.07 5.77-.84L12 3.6Z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconShare() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 4v10M8.5 7.5 12 4l3.5 3.5M6.5 12v6a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2v-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconPlay({ paused }: { paused: boolean }) {
  return paused ? (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 6.5v11l9-5.5-9-5.5Z" fill="currentColor" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 6h3v12H8zM13 6h3v12h-3z" fill="currentColor" />
    </svg>
  );
}

function IconSkip({ next }: { next?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      style={{ transform: next ? undefined : "scaleX(-1)" }}
    >
      <path d="M17 6v12M6 7l8 5-8 5V7Z" fill="currentColor" />
    </svg>
  );
}

export default function GlobalPlayer({ email }: Props) {
  const router = useRouter();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const loadSequence = useRef(0);
  const playbackSessionRef = useRef<string | null>(null);
  const queueRef = useRef<GlobalTrack[]>([]);
  const indexRef = useRef(-1);

  const [queue, setQueue] = useState<GlobalTrack[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [reloadKey, setReloadKey] = useState(0);
  const [visible, setVisible] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [saved, setSaved] = useState(false);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [playbackError, setPlaybackError] = useState("");
  const [time, setTime] = useState({
    current: 0,
    duration: 0,
    progress: 0,
  });

  const currentTrack = useMemo(
    () =>
      currentIndex >= 0 && currentIndex < queue.length
        ? queue[currentIndex]
        : null,
    [queue, currentIndex],
  );

  useEffect(() => {
    queueRef.current = queue;
    indexRef.current = currentIndex;

    if (queue.length && currentIndex >= 0) {
      const state: PersistedPlayer = { queue, currentIndex };
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  }, [queue, currentIndex]);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const restored = JSON.parse(raw) as PersistedPlayer;
      if (
        Array.isArray(restored.queue) &&
        restored.queue.length &&
        restored.currentIndex >= 0
      ) {
        setQueue(restored.queue);
        setCurrentIndex(
          Math.min(restored.currentIndex, restored.queue.length - 1),
        );
        setVisible(true);
      }
    } catch {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const loadQueue = useCallback(
    (tracks: GlobalTrack[], startIndex = 0, toggleSame = false) => {
      if (!tracks.length) return;

      const safeIndex = Math.max(
        0,
        Math.min(startIndex, tracks.length - 1),
      );
      const incoming = tracks[safeIndex];
      const existing =
        queueRef.current[indexRef.current] || null;
      const same =
        Boolean(trackIdentity(incoming)) &&
        trackIdentity(incoming) === trackIdentity(existing);

      if (toggleSame && same && audioRef.current) {
        if (audioRef.current.paused) {
          void audioRef.current.play();
        } else {
          audioRef.current.pause();
        }
        return;
      }

      setQueue(tracks);
      setCurrentIndex(safeIndex);
      setReloadKey((value) => value + 1);
      setVisible(true);
    },
    [],
  );

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      const data = event.data;
      if (!data || typeof data !== "object") return;

      if (data.type === "CALIPH_PLAY" && data.track) {
        loadQueue([data.track as GlobalTrack], 0, false);
      }

      if (data.type === "CALIPH_PLAYER_LOAD_QUEUE") {
        loadQueue(
          Array.isArray(data.tracks) ? data.tracks : [],
          Number(data.startIndex || 0),
          false,
        );
      }

      if (data.type === "CALIPH_PLAYER_TOGGLE_TRACK") {
        loadQueue(
          Array.isArray(data.tracks) ? data.tracks : [],
          Number(data.startIndex || 0),
          true,
        );
      }

      if (data.type === "CALIPH_PLAYER_PLAY") {
        void audioRef.current?.play();
      }

      if (data.type === "CALIPH_PLAYER_PAUSE") {
        audioRef.current?.pause();
      }

      if (
        data.type === "CALIPH_PLAYER_SEEK" &&
        audioRef.current
      ) {
        audioRef.current.currentTime = Math.max(
          0,
          audioRef.current.currentTime + Number(data.delta || 0),
        );
      }
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [loadQueue]);

  async function resolvePlayback(track: GlobalTrack) {
    playbackSessionRef.current = null;

    /*
     * Preserve the established Caliphornia OS track contract.
     *
     * Milia, Fri.ends and other app experiences may already supply a resolved
     * playbackUrl or a direct file path. Those values are intentional and were
     * supported by the original global player. They must be used before falling
     * back to the database playback endpoint.
     */
    const direct = track.playbackUrl || track.file;

    if (direct) {
      return {
        url: String(direct),
        preview: Boolean(track.isPreview),
        start: Number(
          track.resumeSeconds ??
            track.clipStartSeconds ??
            0,
        ),
        end:
          track.clipEndSeconds == null
            ? null
            : Number(track.clipEndSeconds),
      };
    }

    /*
     * Music-library rows and any track without a resolved source use the
     * existing database-backed playback endpoint with the existing song ID
     * and slug fields. No new identifiers or audio-path variables are created.
     */
    const songId = songIdFor(track);
    const songSlug = songSlugFor(track);

    if (!songId && !songSlug) {
      throw new Error("This audio file is not connected.");
    }

    const response = await fetch("/api/playback/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ songId, songSlug }),
    });

    const result = await response.json().catch(() => null);

    if (!response.ok || !result?.ok || !result.playbackUrl) {
      throw new Error(
        result?.error || "This song could not be played.",
      );
    }

    playbackSessionRef.current =
      result.playbackSessionId || null;

    return {
      url: String(result.playbackUrl),
      preview:
        result.access?.playbackMode === "preview" ||
        result.access?.accessType === "preview",
      start: Number(
        result.access?.previewStartSeconds ??
          track.resumeSeconds ??
          track.clipStartSeconds ??
          0,
      ),
      end:
        result.access?.previewEndSeconds == null
          ? track.clipEndSeconds == null
            ? null
            : Number(track.clipEndSeconds)
          : Number(result.access.previewEndSeconds),
    };
  }

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;

    const sequence = ++loadSequence.current;
    let cancelled = false;

    async function load() {
      setPlaybackError("");
      setSaved(false);
      playbackSessionRef.current = null;

      try {
        const playback = await resolvePlayback(currentTrack);

        if (
          cancelled ||
          sequence !== loadSequence.current ||
          !audioRef.current
        ) {
          return;
        }

        const player = audioRef.current;
        player.pause();

        const startAt = Math.max(
          0,
          playback.start ??
            Number(
              currentTrack.resumeSeconds ??
                currentTrack.clipStartSeconds ??
                0,
            ),
        );

        let started = false;

        const startPlayback = async () => {
          if (
            started ||
            cancelled ||
            sequence !== loadSequence.current
          ) {
            return;
          }

          started = true;

          try {
            if (startAt > 0) player.currentTime = startAt;
          } catch {}

          try {
            await player.play();
            setPlaybackError("");
          } catch {
            setPlaybackError("Tap Play to begin.");
          }
        };

        /*
         * Register media listeners before changing src/load. Cached signed URLs
         * can become playable immediately; attaching the listener afterward can
         * miss the event and leave Music visibly loaded but silent.
         */
        player.addEventListener(
          "canplay",
          startPlayback,
          { once: true },
        );

        player.src = playback.url;
        player.load();

        if (player.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
          void startPlayback();
        }

        const params = new URLSearchParams();
        const songId = songIdFor(currentTrack);
        const songSlug = songSlugFor(currentTrack);
        if (songId) params.set("songId", songId);
        if (songSlug) params.set("songSlug", songSlug);

        if (email && (songId || songSlug)) {
          fetch(
            `/api/playlists/is-favorite?${params.toString()}`,
            { cache: "no-store" },
          )
            .then((response) => response.json())
            .then((result) =>
              setSaved(Boolean(result?.ok && result?.saved)),
            )
            .catch(() => setSaved(false));
        }

        setCoverUrl(currentTrack.coverUrl || null);
      } catch (error) {
        if (!cancelled) {
          setPlaybackError(
            error instanceof Error
              ? error.message
              : "This song could not be played.",
          );
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [currentTrack, reloadKey, email]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    function mediaError() {
      const code = audio.error?.code;
      const message =
        code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED
          ? "This audio source is not supported or could not be reached."
          : "This song could not be loaded.";
      setPlaybackError(message);
      setPlaying(false);
    }

    function sync() {
      const current = audio.currentTime || 0;
      const duration =
        Number.isFinite(audio.duration) && audio.duration > 0
          ? audio.duration
          : 0;

      setPlaying(!audio.paused);
      setTime({
        current,
        duration,
        progress: duration
          ? Math.min(1, current / duration)
          : 0,
      });

      const end = currentTrack?.clipEndSeconds;
      if (end != null && current >= Number(end)) {
        audio.pause();
        audio.currentTime = Number(end);
      }

      const payload = {
        type: "CALIPH_PLAYER_STATE",
        songId: songIdFor(currentTrack),
        songSlug: songSlugFor(currentTrack),
        slug: currentTrack?.slug || null,
        playlistSongSlug:
          currentTrack?.playlistSongSlug ||
          songSlugFor(currentTrack),
        isPlaying: !audio.paused,
        currentTime: current,
        duration,
        title: currentTrack?.title || null,
        artist: currentTrack?.artist || null,
        sourceApp: currentTrack?.sourceApp || null,
      };

      window.postMessage(payload, "*");
      document
        .querySelectorAll("iframe")
        .forEach((frame) =>
          frame.contentWindow?.postMessage(payload, "*"),
        );
    }

    function ended() {
      if (playbackSessionRef.current) {
        void fetch("/api/playback/end", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            playbackSessionId: playbackSessionRef.current,
          }),
        });
      }
      skip(1);
    }

    audio.addEventListener("play", sync);
    audio.addEventListener("pause", sync);
    audio.addEventListener("timeupdate", sync);
    audio.addEventListener("loadedmetadata", sync);
    audio.addEventListener("ended", ended);
    audio.addEventListener("error", mediaError);

    return () => {
      audio.removeEventListener("play", sync);
      audio.removeEventListener("pause", sync);
      audio.removeEventListener("timeupdate", sync);
      audio.removeEventListener("loadedmetadata", sync);
      audio.removeEventListener("ended", ended);
      audio.removeEventListener("error", mediaError);
    };
  }, [currentTrack, queue, currentIndex]);

  useEffect(() => {
    document.body.classList.toggle(
      "has-global-player",
      visible && Boolean(currentTrack),
    );

    return () => {
      document.body.classList.remove("has-global-player");
    };
  }, [visible, currentTrack]);

  function skip(direction: -1 | 1) {
    if (!queue.length) return;
    const next =
      (currentIndex + direction + queue.length) %
      queue.length;
    setCurrentIndex(next);
    setReloadKey((value) => value + 1);
  }

  async function toggleFavorite() {
    const songId = songIdFor(currentTrack);
    const songSlug = songSlugFor(currentTrack);
    if (!songId && !songSlug) return;

    const response = await fetch(
      "/api/playlists/toggle-favorite",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ songId, songSlug }),
      },
    );

    const result = await response.json().catch(() => ({}));
    if (result?.ok) setSaved(Boolean(result.saved));
  }

  function openShare() {
    const songId = songIdFor(currentTrack);
    const songSlug = songSlugFor(currentTrack);
    if (!songId && !songSlug) return;

    const params = new URLSearchParams({
      mode: "send",
      scope: "song",
    });

    if (songId) params.set("songId", songId);
    if (songSlug) params.set("songSlug", songSlug);

    router.push(`/apps/share?${params.toString()}`);
  }

  if (!visible || !currentTrack) return null;

  const title = String(
    currentTrack.displayTitle || currentTrack.title || "Song",
  );
  const artist = String(currentTrack.artist || "Caliph");

  return (
    <>
      <audio ref={audioRef} preload="auto" />

      <section
        className={styles.shell}
        aria-label="Global music player"
      >
        <div className={styles.player}>
          <div className={styles.track}>
            <div className={styles.cover}>
              {coverUrl ? (
                <img src={coverUrl} alt="" />
              ) : (
                <span>{title.slice(0, 1)}</span>
              )}
            </div>

            <div className={styles.copy}>
              <strong title={title}>{title}</strong>
              <span title={artist}>{artist}</span>
              {playbackError ? (
                <small>{playbackError}</small>
              ) : null}
            </div>
          </div>

          <div className={styles.timeline}>
            <span>{formatTime(time.current)}</span>
            <div>
              <i
                style={{
                  width: `${time.progress * 100}%`,
                }}
              />
            </div>
            <span>{formatTime(time.duration)}</span>
          </div>

          <div className={styles.controls}>
            <button
              type="button"
              className={saved ? styles.saved : ""}
              onClick={() => void toggleFavorite()}
              aria-label={
                saved
                  ? "Remove from Favorites"
                  : "Add to Favorites"
              }
              title={
                saved
                  ? "Remove from Favorites"
                  : "Add to Favorites"
              }
            >
              <IconStar filled={saved} />
            </button>

            <button
              type="button"
              onClick={openShare}
              aria-label="Share current song"
              title="Share current song"
            >
              <IconShare />
            </button>

            <button
              type="button"
              onClick={() => skip(-1)}
              aria-label="Previous song"
            >
              <IconSkip />
            </button>

            <button
              type="button"
              className={styles.primary}
              onClick={() => {
                const audio = audioRef.current;
                if (!audio) return;
                if (audio.paused) {
                  void audio.play();
                } else {
                  audio.pause();
                }
              }}
              aria-label={playing ? "Pause" : "Play"}
            >
              <IconPlay paused={!playing} />
            </button>

            <button
              type="button"
              onClick={() => skip(1)}
              aria-label="Next song"
            >
              <IconSkip next />
            </button>
          </div>
        </div>
      </section>
    </>
  );
}
