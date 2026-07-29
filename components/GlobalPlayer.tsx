"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type GlobalTrack = {
  id?: string;
  slug?: string;
  songId?: string;
  songSlug?: string;
  title: string;
  artist?: string;
  displayTitle?: string;
  isPreview?: boolean;
  duration?: string;
  description?: string;
  file?: string;
  playbackUrl?: string;
  playlistSongSlug?: string;
  analyticsSongSlug?: string;
  sourceApp?: string;
  coverUrl?: string;
  access?: string;
  clipStart?: number | null;
  clipEnd?: number | null;
  clipStartSeconds?: number | null;
  clipEndSeconds?: number | null;
};

type ActiveTrack = GlobalTrack & {
  playbackUrl: string;
  accessLabel?: string;
};

function looksLikeUuid(value?: string | null) {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function getTrackSlug(track?: GlobalTrack | null) {
  if (!track) return undefined;

  return (
    track.songSlug ||
    track.playlistSongSlug ||
    track.analyticsSongSlug ||
    track.slug ||
    (!looksLikeUuid(track.id) ? track.id : undefined)
  );
}

function getTrackSongId(track?: GlobalTrack | null) {
  if (!track) return undefined;

  if (track.songId) return track.songId;
  if (looksLikeUuid(track.id)) return track.id;

  return undefined;
}

function getTrackTitle(track?: GlobalTrack | null) {
  return track?.displayTitle || track?.title || "Untitled";
}

export default function GlobalPlayer() {
  const [track, setTrack] = useState<ActiveTrack | null>(null);
  const [queue, setQueue] = useState<GlobalTrack[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState("");

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const sessionRef = useRef<string | null>(null);
  const currentTrackRef = useRef<ActiveTrack | null>(null);

  const broadcastPlayerState = useCallback(
    (nextTrack: GlobalTrack | null, playing: boolean) => {
      if (typeof window === "undefined") return;

      window.postMessage(
        {
          type: "CALIPH_PLAYER_STATE",
          isPlaying: playing,
          slug: getTrackSlug(nextTrack),
          playlistSongSlug: nextTrack?.playlistSongSlug || getTrackSlug(nextTrack),
          analyticsSongSlug: nextTrack?.analyticsSongSlug || getTrackSlug(nextTrack),
          sourceApp: nextTrack?.sourceApp || null,
          title: nextTrack ? getTrackTitle(nextTrack) : null,
        },
        "*"
      );
    },
    []
  );

  const startTrack = useCallback(
    async (
      nextTrack: GlobalTrack,
      nextQueue: GlobalTrack[] = [nextTrack],
      nextIndex = 0
    ) => {
      setError("");

      const songId = getTrackSongId(nextTrack);
      const songSlug = getTrackSlug(nextTrack);

      if (!songId && !songSlug) {
        setError("Playback unavailable. This song is missing its canonical ID.");
        return;
      }

      try {
        const res = await fetch("/api/playback/start", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            songId,
            songSlug,
          }),
        });

        const data = await res.json().catch(() => null);

        if (!res.ok || !data?.ok) {
          setError(data?.error || "Playback unavailable.");
          return;
        }

        const access = data.access || {};
        const activeTrack: ActiveTrack = {
          ...nextTrack,
          playbackUrl: data.playbackUrl,
          access: access.displayLabel || nextTrack.access,
          accessLabel: access.displayLabel || nextTrack.access,
          isPreview:
            access.playbackMode === "preview" ||
            access.accessType === "preview" ||
            Boolean(nextTrack.isPreview),
          clipStartSeconds:
            access.previewStartSeconds ??
            nextTrack.clipStartSeconds ??
            nextTrack.clipStart ??
            null,
          clipEndSeconds:
            access.previewEndSeconds ??
            nextTrack.clipEndSeconds ??
            nextTrack.clipEnd ??
            null,
        };

        sessionRef.current = data.playbackSessionId || null;
        currentTrackRef.current = activeTrack;
        setQueue(nextQueue);
        setQueueIndex(nextIndex);
        setTrack(activeTrack);

        setTimeout(() => {
          const audio = audioRef.current;
          if (!audio) return;

          if (typeof activeTrack.clipStartSeconds === "number") {
            audio.currentTime = activeTrack.clipStartSeconds;
          }

          audio
            .play()
            .then(() => {
              setIsPlaying(true);
              broadcastPlayerState(activeTrack, true);
            })
            .catch(() => {
              setIsPlaying(false);
              broadcastPlayerState(activeTrack, false);
            });
        }, 50);
      } catch {
        setError("Playback unavailable.");
      }
    },
    [broadcastPlayerState]
  );

  const toggleCurrentTrack = useCallback(() => {
    const audio = audioRef.current;
    const activeTrack = currentTrackRef.current;

    if (!audio || !activeTrack) return;

    if (audio.paused) {
      audio
        .play()
        .then(() => {
          setIsPlaying(true);
          broadcastPlayerState(activeTrack, true);
        })
        .catch(() => {
          setIsPlaying(false);
          broadcastPlayerState(activeTrack, false);
        });
    } else {
      audio.pause();
      setIsPlaying(false);
      broadcastPlayerState(activeTrack, false);
    }
  }, [broadcastPlayerState]);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      const data = event.data;
      if (!data || typeof data !== "object") return;

      if (data.type === "CALIPH_PLAY" && data.track) {
        void startTrack(data.track as GlobalTrack);
        return;
      }

      if (data.type === "CALIPH_PLAYER_TOGGLE_TRACK") {
        const tracks = Array.isArray(data.tracks)
          ? (data.tracks as GlobalTrack[])
          : [];

        const requestedIndex =
          typeof data.startIndex === "number" && data.startIndex >= 0
            ? data.startIndex
            : 0;

        const nextTrack = tracks[requestedIndex];
        if (!nextTrack) return;

        const activeTrack = currentTrackRef.current;
        const activeSlug = getTrackSlug(activeTrack);
        const nextSlug = getTrackSlug(nextTrack);

        if (activeTrack && activeSlug && nextSlug && activeSlug === nextSlug) {
          toggleCurrentTrack();
          return;
        }

        void startTrack(nextTrack, tracks, requestedIndex);
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [startTrack, toggleCurrentTrack]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !track) return;

    const interval = setInterval(() => {
      if (!sessionRef.current || audio.paused) return;

      void fetch("/api/playback/heartbeat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          playbackSessionId: sessionRef.current,
          secondsPlayed: Math.floor(audio.currentTime),
        }),
      });

      if (
        typeof track.clipEndSeconds === "number" &&
        audio.currentTime >= track.clipEndSeconds
      ) {
        audio.pause();
        setIsPlaying(false);
        broadcastPlayerState(track, false);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [track, broadcastPlayerState]);

  async function handleEnded() {
    if (sessionRef.current) {
      await fetch("/api/playback/end", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          playbackSessionId: sessionRef.current,
        }),
      }).catch(() => {});
    }

    const nextIndex = queueIndex + 1;
    const nextTrack = queue[nextIndex];

    if (nextTrack) {
      void startTrack(nextTrack, queue, nextIndex);
      return;
    }

    setIsPlaying(false);
    broadcastPlayerState(currentTrackRef.current, false);
  }

  if (!track && !error) return null;

  return (
    <div className="player glass">
      {error ? (
        <p className="small" style={{ color: "var(--danger)", margin: 0 }}>
          {error}
        </p>
      ) : null}

      {track ? (
        <>
          <div className="player-row">
            <div>
              <strong>{getTrackTitle(track)}</strong>
              <div className="small muted">
                {track.artist || "Caliph"} ·{" "}
                {track.accessLabel ||
                  track.access ||
                  (track.isPreview ? "Preview" : "Playing")}
              </div>
            </div>

            <button className="btn" type="button" onClick={toggleCurrentTrack}>
              {isPlaying ? "Pause" : "Play"}
            </button>
          </div>

          <audio
            ref={audioRef}
            src={track.playbackUrl}
            controls
            controlsList="nodownload noplaybackrate"
            style={{ width: "100%" }}
            onPlay={() => {
              setIsPlaying(true);
              broadcastPlayerState(currentTrackRef.current, true);
            }}
            onPause={() => {
              setIsPlaying(false);
              broadcastPlayerState(currentTrackRef.current, false);
            }}
            onEnded={() => void handleEnded()}
          />
        </>
      ) : null}
    </div>
  );
}
