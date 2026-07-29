"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type GlobalTrack = {
  id?: string | null;
  slug?: string | null;
  songId?: string | null;
  songSlug?: string | null;
  title: string;
  artist?: string | null;
  displayTitle?: string | null;
  isPreview?: boolean | null;
  duration?: string | null;
  description?: string | null;
  file?: string | null;
  playbackUrl?: string | null;
  playlistSongSlug?: string | null;
  analyticsSongSlug?: string | null;
  sourceApp?: string | null;
  coverUrl?: string | null;
  access?: string | null;
  clipStart?: number | null;
  clipEnd?: number | null;
  clipStartSeconds?: number | null;
  clipEndSeconds?: number | null;
  clipId?: string | null;
  conversationSlug?: string | null;
  conversationRoute?: string | null;
  threadSlug?: string | null;
  messageId?: string | null;
  projectSlug?: string | null;
  projectName?: string | null;
  appSlug?: string | null;
  date?: string | null;
  transcript?: string | null;
  isFriendsFinal?: boolean | null;
  [key: string]: unknown;
};

type ActiveTrack = GlobalTrack & {
  playbackUrl: string;
  accessLabel?: string | null;
};

function looksLikeUuid(value?: string | null) {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function getTrackSlug(track?: GlobalTrack | null) {
  if (!track) return undefined;

  return (
    track.songSlug ||
    track.playlistSongSlug ||
    track.analyticsSongSlug ||
    track.slug ||
    (!looksLikeUuid(track.id || undefined) ? track.id || undefined : undefined)
  );
}

function getTrackSongId(track?: GlobalTrack | null) {
  if (!track) return undefined;
  if (track.songId) return track.songId;
  if (looksLikeUuid(track.id || undefined)) return track.id || undefined;
  return undefined;
}

function getTrackTitle(track?: GlobalTrack | null) {
  return track?.displayTitle || track?.title || "Untitled";
}

function normalizeNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
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
  const queuedRef = useRef<GlobalTrack[]>([]);
  const queueIndexRef = useRef(0);

  const broadcastPlayerState = useCallback((nextTrack: GlobalTrack | null, playing: boolean) => {
    if (typeof window === "undefined") return;

    const audio = audioRef.current;
    const clipStart = normalizeNumber(nextTrack?.clipStartSeconds ?? nextTrack?.clipStart) || 0;
    const clipEnd = normalizeNumber(nextTrack?.clipEndSeconds ?? nextTrack?.clipEnd);
    const currentTime = audio?.currentTime || 0;
    const duration = audio?.duration || 0;
    const clipElapsed = Math.max(0, currentTime - clipStart);
    const clipTotal = clipEnd && clipEnd > clipStart ? clipEnd - clipStart : duration || 0;

    window.postMessage(
      {
        type: "CALIPH_PLAYER_STATE",
        isPlaying: playing,
        slug: getTrackSlug(nextTrack),
        playlistSongSlug: nextTrack?.playlistSongSlug || getTrackSlug(nextTrack),
        analyticsSongSlug: nextTrack?.analyticsSongSlug || getTrackSlug(nextTrack),
        sourceApp: nextTrack?.sourceApp || null,
        title: nextTrack ? getTrackTitle(nextTrack) : null,
        currentTime,
        duration,
        clipId: nextTrack?.clipId || null,
        clipElapsed,
        clipProgress: clipTotal > 0 ? Math.min(1, clipElapsed / clipTotal) : 0,
        conversationSlug: nextTrack?.conversationSlug || null,
        conversationRoute: nextTrack?.conversationRoute || null,
      },
      "*"
    );
  }, []);

  const startTrack = useCallback(
    async (nextTrack: GlobalTrack, nextQueue: GlobalTrack[] = [nextTrack], nextIndex = 0) => {
      setError("");

      const songId = getTrackSongId(nextTrack);
      const songSlug = getTrackSlug(nextTrack);
      const isClip = Boolean(nextTrack.clipId);
      let playbackUrl = nextTrack.playbackUrl || nextTrack.file || null;
      let playbackSessionId: string | null = null;
      let accessLabel = nextTrack.access || null;
      let clipStartSeconds = normalizeNumber(nextTrack.clipStartSeconds ?? nextTrack.clipStart);
      let clipEndSeconds = normalizeNumber(nextTrack.clipEndSeconds ?? nextTrack.clipEnd);
      let isPreview = Boolean(nextTrack.isPreview);

      if (!isClip && (songId || songSlug)) {
        try {
          const res = await fetch("/api/playback/start", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ songId, songSlug }),
          });

          const data = await res.json().catch(() => null);

          if (res.ok && data?.ok && data.playbackUrl) {
            playbackUrl = data.playbackUrl;
            playbackSessionId = data.playbackSessionId || null;
            const access = data.access || {};
            accessLabel = access.displayLabel || accessLabel;
            isPreview =
              access.playbackMode === "preview" ||
              access.accessType === "preview" ||
              isPreview;
            clipStartSeconds = normalizeNumber(access.previewStartSeconds) ?? clipStartSeconds;
            clipEndSeconds = normalizeNumber(access.previewEndSeconds) ?? clipEndSeconds;
          } else if (!playbackUrl) {
            setError(data?.error || "Playback unavailable.");
            return;
          }
        } catch {
          if (!playbackUrl) {
            setError("Playback unavailable.");
            return;
          }
        }
      }

      if (!playbackUrl) {
        setError("Playback unavailable. This track does not have an audio file yet.");
        return;
      }

      const activeTrack: ActiveTrack = {
        ...nextTrack,
        playbackUrl,
        access: accessLabel || nextTrack.access,
        accessLabel,
        isPreview,
        clipStartSeconds,
        clipEndSeconds,
      };

      sessionRef.current = playbackSessionId;
      currentTrackRef.current = activeTrack;
      queuedRef.current = nextQueue;
      queueIndexRef.current = nextIndex;
      setQueue(nextQueue);
      setQueueIndex(nextIndex);
      setTrack(activeTrack);

      setTimeout(() => {
        const audio = audioRef.current;
        if (!audio) return;
        if (typeof clipStartSeconds === "number") audio.currentTime = clipStartSeconds;
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
    },
    [broadcastPlayerState]
  );

  const play = useCallback(() => {
    const audio = audioRef.current;
    const activeTrack = currentTrackRef.current;
    if (!audio || !activeTrack) return;

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
  }, [broadcastPlayerState]);

  const pause = useCallback(() => {
    const audio = audioRef.current;
    const activeTrack = currentTrackRef.current;
    if (!audio || !activeTrack) return;
    audio.pause();
    setIsPlaying(false);
    broadcastPlayerState(activeTrack, false);
  }, [broadcastPlayerState]);

  const toggleCurrentTrack = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) play();
    else pause();
  }, [pause, play]);

  const seekByDelta = useCallback((delta: number) => {
    const audio = audioRef.current;
    const activeTrack = currentTrackRef.current;
    if (!audio) return;

    const start = normalizeNumber(activeTrack?.clipStartSeconds ?? activeTrack?.clipStart) || 0;
    const end = normalizeNumber(activeTrack?.clipEndSeconds ?? activeTrack?.clipEnd);
    const nextTime = Math.max(start, audio.currentTime + delta);
    audio.currentTime = end ? Math.min(end, nextTime) : nextTime;
    broadcastPlayerState(activeTrack, !audio.paused);
  }, [broadcastPlayerState]);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      const data = event.data;
      if (!data || typeof data !== "object") return;

      if (data.type === "CALIPH_PLAY" && data.track) {
        void startTrack(data.track as GlobalTrack);
        return;
      }

      if (data.type === "CALIPH_PLAYER_LOAD_QUEUE") {
        const tracks = Array.isArray(data.tracks) ? (data.tracks as GlobalTrack[]) : [];
        queuedRef.current = tracks;
        queueIndexRef.current = typeof data.startIndex === "number" ? data.startIndex : 0;
        setQueue(tracks);
        setQueueIndex(queueIndexRef.current);
        return;
      }

      if (data.type === "CALIPH_PLAYER_TOGGLE_TRACK") {
        const tracks = Array.isArray(data.tracks) ? (data.tracks as GlobalTrack[]) : [];
        const requestedIndex = typeof data.startIndex === "number" && data.startIndex >= 0 ? data.startIndex : 0;
        const nextTrack = tracks[requestedIndex];
        if (!nextTrack) return;

        const activeTrack = currentTrackRef.current;
        const activeSlug = getTrackSlug(activeTrack);
        const nextSlug = getTrackSlug(nextTrack);
        const sameClip = activeTrack?.clipId && nextTrack.clipId && activeTrack.clipId === nextTrack.clipId;

        if (activeTrack && ((activeSlug && nextSlug && activeSlug === nextSlug) || sameClip)) {
          toggleCurrentTrack();
          return;
        }

        void startTrack(nextTrack, tracks, requestedIndex);
        return;
      }

      if (data.type === "CALIPH_PLAYER_PLAY") {
        play();
        return;
      }

      if (data.type === "CALIPH_PLAYER_PAUSE") {
        pause();
        return;
      }

      if (data.type === "CALIPH_PLAYER_SEEK") {
        seekByDelta(Number(data.delta || 0));
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [pause, play, seekByDelta, startTrack, toggleCurrentTrack]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !track) return;

    const interval = setInterval(() => {
      const activeTrack = currentTrackRef.current;
      if (!activeTrack || audio.paused) return;

      broadcastPlayerState(activeTrack, true);

      if (sessionRef.current) {
        void fetch("/api/playback/heartbeat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            playbackSessionId: sessionRef.current,
            secondsPlayed: Math.floor(audio.currentTime),
          }),
        }).catch(() => {});
      }

      const clipEnd = normalizeNumber(activeTrack.clipEndSeconds ?? activeTrack.clipEnd);
      if (typeof clipEnd === "number" && audio.currentTime >= clipEnd) {
        audio.pause();
        setIsPlaying(false);
        broadcastPlayerState(activeTrack, false);
      }
    }, 500);

    return () => clearInterval(interval);
  }, [track, broadcastPlayerState]);

  async function handleEnded() {
    if (sessionRef.current) {
      await fetch("/api/playback/end", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playbackSessionId: sessionRef.current }),
      }).catch(() => {});
    }

    const nextIndex = queueIndexRef.current + 1;
    const nextTrack = queuedRef.current[nextIndex] || queue[nextIndex];

    if (nextTrack) {
      void startTrack(nextTrack, queuedRef.current.length ? queuedRef.current : queue, nextIndex);
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
                {track.artist || "Caliph"} · {track.accessLabel || track.access || (track.isPreview ? "Preview" : "Playing")}
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
            onTimeUpdate={() => broadcastPlayerState(currentTrackRef.current, !audioRef.current?.paused)}
            onEnded={() => void handleEnded()}
          />
        </>
      ) : null}
    </div>
  );
}
