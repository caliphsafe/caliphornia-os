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
  duration?: string | null;
  description?: string | null;
  file?: string | null;
  playbackUrl?: string | null;
  playlistSongSlug?: string | null;
  analyticsSongSlug?: string | null;
  sourceApp?: string | null;
  coverUrl?: string | null;
  isPreview?: boolean | null;
  access?: string | null;
  clipId?: string | null;
  clipStart?: number | null;
  clipEnd?: number | null;
  clipStartSeconds?: number | null;
  clipEndSeconds?: number | null;
  conversationSlug?: string | null;
  conversationRoute?: string | null;
  projectSlug?: string | null;
  projectName?: string | null;
  [key: string]: unknown;
};

type ActiveTrack = GlobalTrack & { playbackUrl: string };

function looksLikeUuid(value?: string | null) {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function trackSlug(track?: GlobalTrack | null) {
  if (!track) return null;
  return (
    track.songSlug ||
    track.playlistSongSlug ||
    track.analyticsSongSlug ||
    track.slug ||
    (!looksLikeUuid(String(track.id || "")) ? String(track.id || "") : null)
  );
}

function trackSongId(track?: GlobalTrack | null) {
  if (!track) return null;
  return track.songId || (looksLikeUuid(String(track.id || "")) ? String(track.id) : null);
}

function trackTitle(track?: GlobalTrack | null) {
  return track?.displayTitle || track?.title || "Untitled";
}

export default function GlobalPlayer() {
  const [track, setTrack] = useState<ActiveTrack | null>(null);
  const [queue, setQueue] = useState<GlobalTrack[]>([]);
  const [index, setIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState("");

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const activeRef = useRef<ActiveTrack | null>(null);
  const sessionRef = useRef<string | null>(null);

  const broadcast = useCallback((nextTrack: GlobalTrack | null, playing: boolean) => {
    const audio = audioRef.current;
    const start = Number(nextTrack?.clipStartSeconds ?? nextTrack?.clipStart ?? 0);
    const end = Number(nextTrack?.clipEndSeconds ?? nextTrack?.clipEnd ?? audio?.duration ?? 0);
    const current = Number(audio?.currentTime || 0);
    const clipElapsed = Math.max(0, current - start);
    const clipDuration = Math.max(1, end - start);

    window.postMessage(
      {
        type: "CALIPH_PLAYER_STATE",
        isPlaying: playing,
        slug: trackSlug(nextTrack),
        playlistSongSlug: nextTrack?.playlistSongSlug || trackSlug(nextTrack),
        analyticsSongSlug: nextTrack?.analyticsSongSlug || trackSlug(nextTrack),
        sourceApp: nextTrack?.sourceApp || null,
        title: nextTrack ? trackTitle(nextTrack) : null,
        clipId: nextTrack?.clipId || null,
        currentTime: current,
        duration: Number(audio?.duration || 0),
        clipElapsed,
        clipProgress: Math.min(1, Math.max(0, clipElapsed / clipDuration)),
        conversationSlug: nextTrack?.conversationSlug || null,
        conversationRoute: nextTrack?.conversationRoute || null,
      },
      "*"
    );
  }, []);

  const sendHeartbeat = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !sessionRef.current || audio.paused) return;
    void fetch("/api/playback/heartbeat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        playbackSessionId: sessionRef.current,
        secondsPlayed: Math.floor(audio.currentTime),
      }),
    }).catch(() => {});
  }, []);

  const startTrack = useCallback(async (nextTrack: GlobalTrack, nextQueue: GlobalTrack[] = [nextTrack], nextIndex = 0) => {
    setError("");

    let playbackUrl = nextTrack.playbackUrl || nextTrack.file || "";
    let playbackSessionId: string | null = null;
    let accessLabel = nextTrack.access || null;
    let isPreview = Boolean(nextTrack.isPreview);
    let clipStart = nextTrack.clipStartSeconds ?? nextTrack.clipStart ?? null;
    let clipEnd = nextTrack.clipEndSeconds ?? nextTrack.clipEnd ?? null;

    const songId = trackSongId(nextTrack);
    const songSlug = trackSlug(nextTrack);

    if (songId || songSlug) {
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
          accessLabel = data.access?.displayLabel || accessLabel;
          isPreview = data.access?.playbackMode === "preview" || data.access?.accessType === "preview" || isPreview;
          clipStart = data.access?.previewStartSeconds ?? clipStart;
          clipEnd = data.access?.previewEndSeconds ?? clipEnd;
        }
      } catch {
        // The older app experiences often pass an already signed file URL. Keep that working.
      }
    }

    if (!playbackUrl) {
      setError("Playback unavailable for this item.");
      return;
    }

    const active: ActiveTrack = {
      ...nextTrack,
      playbackUrl,
      access: accessLabel || undefined,
      isPreview,
      clipStartSeconds: typeof clipStart === "number" ? clipStart : null,
      clipEndSeconds: typeof clipEnd === "number" ? clipEnd : null,
    };

    activeRef.current = active;
    sessionRef.current = playbackSessionId;
    setQueue(nextQueue);
    setIndex(nextIndex);
    setTrack(active);

    window.setTimeout(() => {
      const audio = audioRef.current;
      if (!audio) return;
      if (typeof active.clipStartSeconds === "number") {
        audio.currentTime = active.clipStartSeconds;
      }
      audio.play().then(() => {
        setIsPlaying(true);
        broadcast(active, true);
      }).catch(() => {
        setIsPlaying(false);
        broadcast(active, false);
      });
    }, 40);
  }, [broadcast]);

  const play = useCallback(() => {
    const audio = audioRef.current;
    const active = activeRef.current;
    if (!audio || !active) return;
    audio.play().then(() => {
      setIsPlaying(true);
      broadcast(active, true);
    }).catch(() => {});
  }, [broadcast]);

  const pause = useCallback(() => {
    const audio = audioRef.current;
    const active = activeRef.current;
    if (!audio) return;
    audio.pause();
    setIsPlaying(false);
    broadcast(active, false);
  }, [broadcast]);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) play();
    else pause();
  }, [pause, play]);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      const data = event.data;
      if (!data || typeof data !== "object") return;

      if (data.type === "CALIPH_PLAY" && data.track) {
        void startTrack(data.track as GlobalTrack);
        return;
      }

      if (data.type === "CALIPH_PLAYER_LOAD_QUEUE" || data.type === "CALIPH_PLAYER_TOGGLE_TRACK") {
        const tracks = Array.isArray(data.tracks) ? (data.tracks as GlobalTrack[]) : [];
        const nextIndex = typeof data.startIndex === "number" ? data.startIndex : 0;
        const nextTrack = tracks[nextIndex];
        if (!nextTrack) return;

        const currentSlug = trackSlug(activeRef.current);
        const nextSlug = trackSlug(nextTrack);

        if (data.type === "CALIPH_PLAYER_TOGGLE_TRACK" && currentSlug && nextSlug && currentSlug === nextSlug) {
          toggle();
          return;
        }

        void startTrack(nextTrack, tracks, nextIndex);
        return;
      }

      if (data.type === "CALIPH_PLAYER_PLAY") play();
      if (data.type === "CALIPH_PLAYER_PAUSE") pause();
      if (data.type === "CALIPH_PLAYER_SEEK") {
        const audio = audioRef.current;
        if (!audio) return;
        const delta = Number(data.delta || 0);
        audio.currentTime = Math.max(0, audio.currentTime + delta);
        broadcast(activeRef.current, !audio.paused);
      }
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [broadcast, pause, play, startTrack, toggle]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const audio = audioRef.current;
      const active = activeRef.current;
      if (!audio || !active) return;

      sendHeartbeat();
      broadcast(active, !audio.paused);

      if (typeof active.clipEndSeconds === "number" && audio.currentTime >= active.clipEndSeconds) {
        audio.pause();
        setIsPlaying(false);
        broadcast(active, false);
      }
    }, 1000);

    return () => window.clearInterval(interval);
  }, [broadcast, sendHeartbeat]);

  async function handleEnded() {
    if (sessionRef.current) {
      await fetch("/api/playback/end", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playbackSessionId: sessionRef.current }),
      }).catch(() => {});
    }

    const nextIndex = index + 1;
    const nextTrack = queue[nextIndex];
    if (nextTrack) {
      void startTrack(nextTrack, queue, nextIndex);
      return;
    }

    setIsPlaying(false);
    broadcast(activeRef.current, false);
  }

  if (!track && !error) return null;

  return (
    <div className="caliph-global-player" data-source={track?.sourceApp || "music"}>
      {error ? <p className="caliph-global-player-error">{error}</p> : null}
      {track ? (
        <>
          <div className="caliph-global-player-main">
            {track.coverUrl ? <img src={track.coverUrl} alt="" /> : <div className="caliph-global-player-art">♪</div>}
            <div className="caliph-global-player-meta">
              <strong>{trackTitle(track)}</strong>
              <span>{track.artist || "Caliph"}{track.isPreview ? " · Preview" : track.access ? ` · ${track.access}` : ""}</span>
            </div>
            <button type="button" onClick={toggle} aria-label={isPlaying ? "Pause" : "Play"}>
              {isPlaying ? "⏸" : "▶"}
            </button>
          </div>
          <audio
            ref={audioRef}
            src={track.playbackUrl}
            controls
            controlsList="nodownload noplaybackrate"
            onPlay={() => {
              setIsPlaying(true);
              broadcast(activeRef.current, true);
            }}
            onPause={() => {
              setIsPlaying(false);
              broadcast(activeRef.current, false);
            }}
            onEnded={() => void handleEnded()}
          />
        </>
      ) : null}
    </div>
  );
}
