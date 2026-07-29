"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

export type GlobalTrack = {
  id?: string | null;
  songId?: string | null;
  slug?: string | null;
  songSlug?: string | null;
  title: string;
  artist?: string | null;
  displayTitle?: string | null;
  date?: string | null;
  duration?: string | null;
  file?: string | null;
  playbackUrl?: string | null;
  transcript?: string | null;
  description?: string | null;
  clipId?: string | null;
  clipStartSeconds?: number | null;
  clipEndSeconds?: number | null;
  playlistSongSlug?: string | null;
  analyticsSongSlug?: string | null;
  sourceApp?: string | null;
  isPreview?: boolean | null;
  conversationSlug?: string | null;
  conversationRoute?: string | null;
  isFriendsFinal?: boolean;
  resumeSeconds?: number | null;
  coverUrl?: string | null;
  coverPath?: string | null;
  coverBucket?: string | null;
  access?: string | null;
  [key: string]: unknown;
};

type Props = {
  email: string;
};

type FriendsConversationListItem = {
  slug: string;
  title?: string | null;
  subtitle?: string | null;
  final_track?: {
    slug?: string | null;
    title?: string | null;
    artist?: string | null;
    file?: string | null;
    playlist_song_slug?: string | null;
    analytics_song_slug?: string | null;
  } | null;
};

function looksLikeUuid(value?: string | null) {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function getTrackParts(title: string, artist?: string | null) {
  if (artist && artist.trim()) return { artist: artist.trim(), song: String(title || "").trim() };
  const raw = String(title || "").trim();
  const parts = raw.split(/\s*-\s*/);
  if (parts.length >= 2) return { artist: parts[0].trim(), song: parts.slice(1).join(" - ").trim() };
  return { artist: "Caliph", song: raw };
}

function getDisplaySongTitle(track: GlobalTrack | null) {
  if (!track) return "";
  const title = String(track.displayTitle || track.title || "");
  if (track.isPreview && !title.toLowerCase().includes("(preview)")) return `${title} (Preview)`;
  return title;
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

function IconPrev() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" className="gp-icon"><path d="M7 6v12M18 7l-7 5 7 5V7Z" fill="currentColor" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" strokeLinecap="round" /></svg>;
}
function IconNext() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" className="gp-icon"><path d="M17 6v12M6 7l7 5-7 5V7Z" fill="currentColor" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" strokeLinecap="round" /></svg>;
}
function IconPlay() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" className="gp-icon gp-icon-play"><path d="M8 6.5v11l9-5.5-9-5.5Z" fill="currentColor" /></svg>;
}
function IconPause() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" className="gp-icon"><path d="M8 6h3v12H8zM13 6h3v12h-3z" fill="currentColor" /></svg>;
}
function IconStar({ filled }: { filled: boolean }) {
  return filled ? (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="gp-icon"><path d="M12 3.8l2.52 5.11 5.64.82-4.08 3.98.96 5.62L12 16.66 6.96 19.33l.96-5.62L3.84 9.73l5.64-.82L12 3.8Z" fill="currentColor" /></svg>
  ) : (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="gp-icon"><path d="M12 3.8l2.52 5.11 5.64.82-4.08 3.98.96 5.62L12 16.66 6.96 19.33l.96-5.62L3.84 9.73l5.64-.82L12 3.8Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /></svg>
  );
}

function normalizeFriendsFinalTrack(convo: FriendsConversationListItem): GlobalTrack | null {
  const finalTrack = convo.final_track;
  if (!finalTrack?.file) return null;
  return {
    slug: finalTrack.slug || `${convo.slug}-final`,
    title: finalTrack.title || convo.title || convo.slug,
    artist: finalTrack.artist || convo.subtitle || "",
    displayTitle: convo.title || convo.slug,
    description: "Final song",
    file: finalTrack.file,
    playlistSongSlug: finalTrack.playlist_song_slug || finalTrack.slug || null,
    analyticsSongSlug: finalTrack.analytics_song_slug || finalTrack.playlist_song_slug || finalTrack.slug || null,
    sourceApp: "friends",
    conversationSlug: convo.slug,
    conversationRoute: `/apps/friends/${convo.slug}`,
    isFriendsFinal: true
  };
}

function MarqueeText({ text, active = true }: { text: string; active?: boolean }) {
  const shouldMarquee = active && text.length > 22;
  return <span className={shouldMarquee ? "music-marquee-shell" : "music-ellipsis"}><span className={shouldMarquee ? "music-marquee-track" : ""}><span>{text}</span></span></span>;
}

export default function GlobalPlayer({ email }: Props) {
  const router = useRouter();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playbackSessionRef = useRef<string | null>(null);

  const [queue, setQueue] = useState<GlobalTrack[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [friendsFinalQueue, setFriendsFinalQueue] = useState<GlobalTrack[]>([]);
  const [resolvedCoverUrl, setResolvedCoverUrl] = useState<string | null>(null);
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const [playerTime, setPlayerTime] = useState({ current: 0, duration: 0, progress: 0 });

  const currentTrack = useMemo(() => {
    if (currentIndex < 0 || currentIndex >= queue.length) return null;
    return queue[currentIndex];
  }, [queue, currentIndex]);

  const trackParts = useMemo(() => getTrackParts(getDisplaySongTitle(currentTrack), currentTrack?.artist), [currentTrack]);

  function getCurrentTrackSongSlug(track: GlobalTrack | null) {
    if (!track) return null;
    return track.songSlug || track.playlistSongSlug || track.analyticsSongSlug || track.slug || null;
  }

  function getCurrentTrackSongId(track: GlobalTrack | null) {
    if (!track) return null;
    if (track.songId) return track.songId;
    if (track.id && looksLikeUuid(String(track.id))) return String(track.id);
    return null;
  }

  async function loadFriendsFinalQueue() {
    try {
      const res = await fetch("/api/apps/friends/conversations", { cache: "no-store" });
      const data = await res.json();
      const conversations = Array.isArray(data?.conversations) ? data.conversations : [];
      const normalized = conversations.map((convo: FriendsConversationListItem) => normalizeFriendsFinalTrack(convo)).filter(Boolean) as GlobalTrack[];
      setFriendsFinalQueue(normalized);
      return normalized;
    } catch {
      return [];
    }
  }

  async function resolveTrackUrl(track: GlobalTrack | null) {
    playbackSessionRef.current = null;
    if (!track) return null;
    if (track.playbackUrl) return track.playbackUrl;
    if (track.file) return track.file;

    const songId = getCurrentTrackSongId(track);
    const songSlug = getCurrentTrackSongSlug(track);
    if (!songId && !songSlug) return null;

    try {
      const res = await fetch("/api/playback/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ songId, songSlug })
      });
      const data = await res.json();
      if (!res.ok || !data?.ok || !data?.playbackUrl) return null;
      playbackSessionRef.current = data.playbackSessionId || null;
      if (data.access) {
        track.isPreview = data.access.playbackMode === "preview" || data.access.accessType === "preview";
        track.clipStartSeconds = data.access.previewStartSeconds ?? track.clipStartSeconds ?? null;
        track.clipEndSeconds = data.access.previewEndSeconds ?? track.clipEndSeconds ?? null;
      }
      return data.playbackUrl as string;
    } catch {
      return null;
    }
  }

  function getPlaylistTarget(track: GlobalTrack | null) {
    const songId = getCurrentTrackSongId(track);
    const songSlug = getCurrentTrackSongSlug(track);
    return { songId, songSlug };
  }

  async function refreshFavoriteState(track: GlobalTrack | null) {
    const { songId, songSlug } = getPlaylistTarget(track);
    if (!email || (!songId && !songSlug)) {
      setIsSaved(false);
      return;
    }

    try {
      const params = new URLSearchParams();
      if (songId) params.set("songId", songId);
      if (songSlug) params.set("songSlug", songSlug);
      const res = await fetch(`/api/playlists/is-favorite?${params.toString()}`, { cache: "no-store" });
      const data = await res.json();
      setIsSaved(Boolean(data?.ok && data?.saved));
    } catch {
      setIsSaved(false);
    }
  }

  function broadcastState() {
    const audio = audioRef.current;
    const start = currentTrack?.resumeSeconds ?? currentTrack?.clipStartSeconds ?? 0;
    const end = currentTrack?.clipEndSeconds ?? null;
    const current = audio?.currentTime || 0;
    const elapsed = Math.max(0, current - start);
    const clipDuration = end != null ? Math.max(0, end - start) : audio?.duration && Number.isFinite(audio.duration) ? Math.max(0, audio.duration - start) : 0;

    const payload = {
      type: "CALIPH_PLAYER_STATE",
      slug: currentTrack?.slug || currentTrack?.songSlug || null,
      clipId: currentTrack?.clipId || null,
      playlistSongSlug: currentTrack?.playlistSongSlug || currentTrack?.songSlug || currentTrack?.slug || null,
      analyticsSongSlug: currentTrack?.analyticsSongSlug || currentTrack?.songSlug || currentTrack?.slug || null,
      isPlaying: audio ? !audio.paused : false,
      currentTime: current,
      duration: audio?.duration || 0,
      clipElapsed: elapsed,
      clipDuration,
      clipProgress: clipDuration > 0 ? Math.min(1, elapsed / clipDuration) : 0,
      sourceApp: currentTrack?.sourceApp || null,
      conversationSlug: currentTrack?.conversationSlug || null,
      title: currentTrack?.title || null
    };

    window.postMessage(payload, "*");
    document.querySelectorAll("iframe").forEach((frame) => frame.contentWindow?.postMessage(payload, "*"));
  }

  async function advanceWithinCurrentProject(direction: "next" | "prev" = "next") {
    if (!currentTrack) return;

    if (currentTrack.sourceApp === "friends") {
      const finals = friendsFinalQueue.length ? friendsFinalQueue : await loadFriendsFinalQueue();
      if (!finals.length) return;
      const currentConversationSlug = currentTrack.conversationSlug || currentTrack.playlistSongSlug || currentTrack.slug;
      const currentFinalIndex = finals.findIndex((track) => track.conversationSlug === currentConversationSlug);
      const nextFinalIndex = direction === "prev" ? currentFinalIndex <= 0 ? finals.length - 1 : currentFinalIndex - 1 : currentFinalIndex >= finals.length - 1 || currentFinalIndex === -1 ? 0 : currentFinalIndex + 1;
      setQueue(finals);
      setCurrentIndex(nextFinalIndex);
      setIsVisible(true);
      return;
    }

    if (!queue.length) return;
    const nextIndex = direction === "prev" ? currentIndex <= 0 ? queue.length - 1 : currentIndex - 1 : currentIndex >= queue.length - 1 ? 0 : currentIndex + 1;
    setCurrentIndex(nextIndex);
    setIsVisible(true);
  }

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      const data = event.data;
      if (!data || typeof data !== "object") return;

      if (data.type === "CALIPH_PLAY" && data.track) {
        setQueue([data.track as GlobalTrack]);
        setCurrentIndex(0);
        setIsVisible(true);
      }

      if (data.type === "CALIPH_PLAYER_LOAD_QUEUE") {
        const tracks = Array.isArray(data.tracks) ? data.tracks : [];
        const startIndex = typeof data.startIndex === "number" ? data.startIndex : 0;
        if (!tracks.length) return;
        setQueue(tracks);
        setCurrentIndex(startIndex);
        setIsVisible(true);
      }

      if (data.type === "CALIPH_PLAYER_TOGGLE_TRACK") {
        const tracks = Array.isArray(data.tracks) ? data.tracks : [];
        const startIndex = typeof data.startIndex === "number" ? data.startIndex : 0;
        if (!tracks.length) return;
        const incoming = tracks[startIndex];
        const same = currentTrack && incoming && ((currentTrack.clipId && incoming.clipId && currentTrack.clipId === incoming.clipId) || (currentTrack.slug && incoming.slug && currentTrack.slug === incoming.slug));
        if (same && audioRef.current) {
          if (audioRef.current.paused) audioRef.current.play().catch(() => {});
          else audioRef.current.pause();
          return;
        }
        setQueue(tracks);
        setCurrentIndex(startIndex);
        setIsVisible(true);
      }

      if (data.type === "CALIPH_PLAYER_PLAY") audioRef.current?.play().catch(() => {});
      if (data.type === "CALIPH_PLAYER_PAUSE") audioRef.current?.pause();
      if (data.type === "CALIPH_PLAYER_SEEK") {
        const delta = Number(data.delta || 0);
        if (audioRef.current) {
          audioRef.current.currentTime = Math.max(0, (audioRef.current.currentTime || 0) + delta);
          broadcastState();
        }
      }
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [currentTrack]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;

    let cancelled = false;
    const start = currentTrack.resumeSeconds ?? currentTrack.clipStartSeconds ?? 0;

    async function load() {
      const url = await resolveTrackUrl(currentTrack);
      if (cancelled || !url || !audio) return;
      setPlaybackUrl(url);
      audio.pause();
      audio.src = url;
      audio.load();

      const onCanPlay = async () => {
        audio.removeEventListener("canplay", onCanPlay);
        try { audio.currentTime = start; } catch {}
        audio.play().catch(() => {});
        setIsVisible(true);
        setTimeout(() => broadcastState(), 50);
      };

      audio.addEventListener("canplay", onCanPlay, { once: true });

      const analyticsSlug = currentTrack.analyticsSongSlug || currentTrack.playlistSongSlug || currentTrack.songSlug || currentTrack.slug;
      const analyticsSongId = getCurrentTrackSongId(currentTrack);
      if (analyticsSlug || analyticsSongId) {
        void fetch("/api/events/song-play", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ songId: analyticsSongId, songSlug: analyticsSlug, sourcePath: window.location.pathname, appSlug: currentTrack.sourceApp || null })
        }).catch(() => {});
      }

      void refreshFavoriteState(currentTrack);

      if (currentTrack.sourceApp === "friends" && currentTrack.conversationRoute) {
        const path = window.location.pathname;
        const isOnFriendsConversationPage = path.startsWith("/apps/friends/") && path !== "/apps/friends";
        if (isOnFriendsConversationPage && path !== currentTrack.conversationRoute) router.push(currentTrack.conversationRoute);
      }
    }

    void load();
    return () => { cancelled = true; };
  }, [currentTrack, email, router]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    function sync() {
      const currentAudio = audioRef.current;
      if (!currentAudio) return;
      setIsPlaying(!currentAudio.paused);
      const start = currentTrack?.resumeSeconds ?? currentTrack?.clipStartSeconds ?? 0;
      const end = currentTrack?.clipEndSeconds ?? null;
      const rawDuration = end != null ? Math.max(0, end - start) : currentAudio.duration && Number.isFinite(currentAudio.duration) ? Math.max(0, currentAudio.duration - start) : 0;
      const rawCurrent = Math.max(0, (currentAudio.currentTime || 0) - start);
      setPlayerTime({ current: rawCurrent, duration: rawDuration, progress: rawDuration > 0 ? Math.min(1, rawCurrent / rawDuration) : 0 });

      if (currentTrack?.clipEndSeconds != null && currentAudio.currentTime >= currentTrack.clipEndSeconds) {
        currentAudio.pause();
        currentAudio.currentTime = currentTrack.clipEndSeconds;
      }

      if (playbackSessionRef.current && !currentAudio.paused) {
        void fetch("/api/playback/heartbeat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ playbackSessionId: playbackSessionRef.current, secondsPlayed: Math.floor(currentAudio.currentTime || 0) })
        }).catch(() => {});
      }

      broadcastState();
    }

    function onEnded() {
      if (playbackSessionRef.current) {
        void fetch("/api/playback/end", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ playbackSessionId: playbackSessionRef.current })
        }).catch(() => {});
      }
      if (currentTrack?.clipEndSeconds != null) return;
      void advanceWithinCurrentProject("next");
    }

    audio.addEventListener("play", sync);
    audio.addEventListener("pause", sync);
    audio.addEventListener("timeupdate", sync);
    audio.addEventListener("loadedmetadata", sync);
    audio.addEventListener("seeked", sync);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.removeEventListener("play", sync);
      audio.removeEventListener("pause", sync);
      audio.removeEventListener("timeupdate", sync);
      audio.removeEventListener("loadedmetadata", sync);
      audio.removeEventListener("seeked", sync);
      audio.removeEventListener("ended", onEnded);
    };
  }, [currentTrack, currentIndex, queue, friendsFinalQueue, playbackUrl]);

  useEffect(() => {
    const rawSongSlug = getCurrentTrackSongSlug(currentTrack);
    if (!rawSongSlug) {
      setResolvedCoverUrl(null);
      return;
    }
    let isCancelled = false;
    async function fetchCover() {
      try {
        const res = await fetch(`/api/songs/by-slug/${encodeURIComponent(rawSongSlug)}`, { cache: "no-store" });
        const data = await res.json();
        if (!isCancelled) setResolvedCoverUrl(data?.ok ? data.song?.coverUrl || null : null);
      } catch {
        if (!isCancelled) setResolvedCoverUrl(null);
      }
    }
    fetchCover();
    return () => { isCancelled = true; };
  }, [currentTrack]);

  useEffect(() => {
    const shouldOffset = Boolean(isVisible && currentTrack);
    document.body.classList.toggle("has-global-player", shouldOffset);
    return () => document.body.classList.remove("has-global-player");
  }, [isVisible, currentTrack]);

  async function playPrev() { await advanceWithinCurrentProject("prev"); }
  async function playNext() { await advanceWithinCurrentProject("next"); }

  async function togglePlaylistSave() {
    const { songId, songSlug } = getPlaylistTarget(currentTrack);
    if (!songId && !songSlug) return;
    const res = await fetch("/api/playlists/toggle-favorite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ songId, songSlug })
    });
    const data = await res.json();
    if (data?.ok) setIsSaved(Boolean(data.saved));
  }

  if (!isVisible || !currentTrack) return null;

  return (
    <>
      <audio ref={audioRef} />
      <div className="music-inline-player-shell global-player">
        <div className="music-inline-player">
          <div className="music-inline-player-left">
            <div className="music-inline-cover">
              {resolvedCoverUrl ? <img src={resolvedCoverUrl} alt={trackParts.song} /> : <div className="music-inline-cover-fallback">{trackParts.song?.[0] || "♪"}</div>}
            </div>
            <div className="music-inline-copy">
              <div className="music-inline-title"><MarqueeText text={trackParts.song} active={true} /></div>
              <div className="music-inline-artist music-ellipsis">{trackParts.artist}</div>
              <div className="music-inline-progress">
                <span>{formatTime(playerTime.current)}</span>
                <div className="music-inline-progress-track"><span className="music-inline-progress-fill" style={{ width: `${playerTime.progress * 100}%` }} /></div>
                <span>{formatTime(playerTime.duration)}</span>
              </div>
            </div>
          </div>

          <div className="music-inline-controls">
            <button onClick={togglePlaylistSave} className={`music-inline-btn ${isSaved ? "is-saved" : ""}`} aria-label="Favorite"><IconStar filled={isSaved} /></button>
            <button onClick={playPrev} className="music-inline-btn" aria-label="Previous"><IconPrev /></button>
            <button onClick={() => { if (!audioRef.current) return; if (audioRef.current.paused) audioRef.current.play().catch(() => {}); else audioRef.current.pause(); }} className="music-inline-btn music-inline-btn-main" aria-label="Play or pause">{isPlaying ? <IconPause /> : <IconPlay />}</button>
            <button onClick={playNext} className="music-inline-btn" aria-label="Next"><IconNext /></button>
          </div>
        </div>
      </div>
    </>
  );
}
