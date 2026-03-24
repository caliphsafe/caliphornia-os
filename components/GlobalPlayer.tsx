"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

export type GlobalTrack = {
  id?: string | null;
  slug?: string | null;
  title: string;
  artist?: string;
  displayTitle?: string;
  date?: string;
  duration?: string;
  file: string;
  transcript?: string;
  description?: string;
  clipId?: string | null;
  clipStartSeconds?: number | null;
  clipEndSeconds?: number | null;
  playlistSongSlug?: string | null;
  analyticsSongSlug?: string | null;

  sourceApp?: string | null;
  conversationSlug?: string | null;
  conversationRoute?: string | null;
  isFriendsFinal?: boolean;
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

function getTrackParts(title: string, artist?: string) {
  if (artist && artist.trim()) {
    return { artist: artist.trim(), song: String(title || "").trim() };
  }

  const raw = String(title || "").trim();
  const parts = raw.split(/\s*-\s*/);

  if (parts.length >= 2) {
    return {
      artist: parts[0].trim(),
      song: parts.slice(1).join(" - ").trim()
    };
  }

  return {
    artist: "Caliph",
    song: raw
  };
}

function IconPrev() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="gp-icon">
      <path
        d="M7 6v12M18 7l-7 5 7 5V7Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconNext() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="gp-icon">
      <path
        d="M17 6v12M6 7l7 5-7 5V7Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconPlay() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="gp-icon gp-icon-play">
      <path d="M8 6.5v11l9-5.5-9-5.5Z" fill="currentColor" />
    </svg>
  );
}

function IconPause() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="gp-icon">
      <path d="M8 6h3v12H8zM13 6h3v12h-3z" fill="currentColor" />
    </svg>
  );
}

function IconMinimize() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="gp-icon gp-icon-small">
      <path
        d="M7 12h10"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconStar({ filled }: { filled: boolean }) {
  if (filled) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="gp-icon">
        <path
          d="M12 3.8l2.52 5.11 5.64.82-4.08 3.98.96 5.62L12 16.66 6.96 19.33l.96-5.62L3.84 9.73l5.64-.82L12 3.8Z"
          fill="currentColor"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="gp-icon">
      <path
        d="M12 3.8l2.52 5.11 5.64.82-4.08 3.98.96 5.62L12 16.66 6.96 19.33l.96-5.62L3.84 9.73l5.64-.82L12 3.8Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
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

export default function GlobalPlayer({ email }: Props) {
  const router = useRouter();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [queue, setQueue] = useState<GlobalTrack[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [isVisible, setIsVisible] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [friendsFinalQueue, setFriendsFinalQueue] = useState<GlobalTrack[]>([]);

  const currentTrack = useMemo(() => {
    if (currentIndex < 0 || currentIndex >= queue.length) return null;
    return queue[currentIndex];
  }, [queue, currentIndex]);

  const trackParts = useMemo(() => {
    return getTrackParts(
      currentTrack?.displayTitle || currentTrack?.title || "",
      currentTrack?.artist
    );
  }, [currentTrack]);

  async function loadFriendsFinalQueue() {
    try {
      const res = await fetch("/api/apps/friends/conversations", {
        cache: "no-store"
      });

      const data = await res.json();
      const conversations = Array.isArray(data?.conversations) ? data.conversations : [];

      const normalized = conversations
        .map((convo: FriendsConversationListItem) => normalizeFriendsFinalTrack(convo))
        .filter(Boolean) as GlobalTrack[];

      setFriendsFinalQueue(normalized);
      return normalized;
    } catch (error) {
      console.error("Failed to load Friends final queue", error);
      return [];
    }
  }

  function broadcastState() {
    const audio = audioRef.current;
    const start = currentTrack?.clipStartSeconds || 0;
    const end = currentTrack?.clipEndSeconds ?? null;
    const current = audio?.currentTime || 0;
    const elapsed = Math.max(0, current - start);
    const clipDuration =
      end != null
        ? Math.max(0, end - start)
        : audio?.duration && Number.isFinite(audio.duration)
          ? Math.max(0, audio.duration - start)
          : 0;

    const payload = {
      type: "CALIPH_PLAYER_STATE",
      slug: currentTrack?.slug || null,
      clipId: currentTrack?.clipId || null,
      playlistSongSlug: currentTrack?.playlistSongSlug || null,
      isPlaying: audio ? !audio.paused : false,
      currentTime: current,
      duration: audio?.duration || 0,
      clipElapsed: elapsed,
      clipDuration,
      clipProgress: clipDuration > 0 ? Math.min(1, elapsed / clipDuration) : 0,
      sourceApp: currentTrack?.sourceApp || null,
      conversationSlug: currentTrack?.conversationSlug || null
    };

    window.postMessage(payload, "*");

    document.querySelectorAll("iframe").forEach((frame) => {
      frame.contentWindow?.postMessage(payload, "*");
    });
  }

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      const data = event.data;
      if (!data || typeof data !== "object") return;

      if (data.type === "CALIPH_PLAYER_LOAD_QUEUE") {
        const tracks = Array.isArray(data.tracks) ? data.tracks : [];
        const startIndex = typeof data.startIndex === "number" ? data.startIndex : 0;
        if (!tracks.length) return;

        setQueue(tracks);
        setCurrentIndex(startIndex);
        setIsVisible(true);
        setIsExpanded(true);
      }

      if (data.type === "CALIPH_PLAYER_TOGGLE_TRACK") {
        const tracks = Array.isArray(data.tracks) ? data.tracks : [];
        const startIndex = typeof data.startIndex === "number" ? data.startIndex : 0;
        if (!tracks.length) return;

        const incoming = tracks[startIndex];
        const same =
          currentTrack &&
          incoming &&
          ((currentTrack.clipId && incoming.clipId && currentTrack.clipId === incoming.clipId) ||
            (currentTrack.slug && incoming.slug && currentTrack.slug === incoming.slug));

        if (same && audioRef.current) {
          if (audioRef.current.paused) {
            audioRef.current.play().catch(() => {});
          } else {
            audioRef.current.pause();
          }
          return;
        }

        setQueue(tracks);
        setCurrentIndex(startIndex);
        setIsVisible(true);
        setIsExpanded(true);
      }

      if (data.type === "CALIPH_PLAYER_PLAY") {
        audioRef.current?.play().catch(() => {});
      }

      if (data.type === "CALIPH_PLAYER_PAUSE") {
        audioRef.current?.pause();
      }

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
    if (!audio || !currentTrack?.file) return;

    const start = currentTrack.clipStartSeconds || 0;
    const sameSrc = audio.src === currentTrack.file;

    const beginPlayback = async () => {
      try {
        audio.currentTime = start;
      } catch {}

      audio.play().catch(() => {});
      setIsVisible(true);
      setIsExpanded(true);
      setTimeout(() => broadcastState(), 50);
    };

    if (!sameSrc) {
      audio.pause();
      audio.src = currentTrack.file;
      audio.load();

      const onCanPlay = async () => {
        audio.removeEventListener("canplay", onCanPlay);
        await beginPlayback();
      };

      audio.addEventListener("canplay", onCanPlay, { once: true });
    } else {
      void beginPlayback();
    }

    setIsSaved(false);

    const analyticsSlug =
      currentTrack.analyticsSongSlug ||
      currentTrack.playlistSongSlug ||
      currentTrack.slug;

    if (analyticsSlug) {
      void fetch("/api/events/song-play", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          userEmail: email,
          songSlug: analyticsSlug,
          sourcePath: window.location.pathname
        })
      });
    }

    if (currentTrack.sourceApp === "friends" && currentTrack.conversationRoute) {
      if (window.location.pathname !== currentTrack.conversationRoute) {
        router.push(currentTrack.conversationRoute);
      }
    }
  }, [currentTrack, email, router]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    function sync() {
      const currentAudio = audioRef.current;
      if (!currentAudio) return;

      setIsPlaying(!currentAudio.paused);

      if (
        currentTrack?.clipEndSeconds != null &&
        currentAudio.currentTime >= currentTrack.clipEndSeconds
      ) {
        currentAudio.pause();
        currentAudio.currentTime = currentTrack.clipEndSeconds;
      }

      broadcastState();
    }

    audio.addEventListener("play", sync);
    audio.addEventListener("pause", sync);
    audio.addEventListener("timeupdate", sync);
    audio.addEventListener("loadedmetadata", sync);
    audio.addEventListener("seeked", sync);

    return () => {
      audio.removeEventListener("play", sync);
      audio.removeEventListener("pause", sync);
      audio.removeEventListener("timeupdate", sync);
      audio.removeEventListener("loadedmetadata", sync);
      audio.removeEventListener("seeked", sync);
    };
  }, [currentTrack]);

  async function playPrev() {
    if (!currentTrack) return;

    if (currentTrack.sourceApp === "friends") {
      const finals = friendsFinalQueue.length ? friendsFinalQueue : await loadFriendsFinalQueue();
      if (!finals.length) return;

      const currentConversationSlug =
        currentTrack.conversationSlug ||
        currentTrack.playlistSongSlug ||
        currentTrack.slug;

      const currentFinalIndex = finals.findIndex(
        (track) => track.conversationSlug === currentConversationSlug
      );

      const nextFinalIndex =
        currentFinalIndex <= 0 ? finals.length - 1 : currentFinalIndex - 1;

      setQueue(finals);
      setCurrentIndex(nextFinalIndex);
      setIsVisible(true);
      setIsExpanded(true);
      return;
    }

    if (!queue.length) return;
    const next = currentIndex <= 0 ? queue.length - 1 : currentIndex - 1;
    setCurrentIndex(next);
  }

  async function playNext() {
    if (!currentTrack) return;

    if (currentTrack.sourceApp === "friends") {
      const finals = friendsFinalQueue.length ? friendsFinalQueue : await loadFriendsFinalQueue();
      if (!finals.length) return;

      const currentConversationSlug =
        currentTrack.conversationSlug ||
        currentTrack.playlistSongSlug ||
        currentTrack.slug;

      const currentFinalIndex = finals.findIndex(
        (track) => track.conversationSlug === currentConversationSlug
      );

      const nextFinalIndex =
        currentFinalIndex >= finals.length - 1 || currentFinalIndex === -1 ? 0 : currentFinalIndex + 1;

      setQueue(finals);
      setCurrentIndex(nextFinalIndex);
      setIsVisible(true);
      setIsExpanded(true);
      return;
    }

    if (!queue.length) return;
    const next = currentIndex >= queue.length - 1 ? 0 : currentIndex + 1;
    setCurrentIndex(next);
  }

  async function togglePlaylistSave() {
    const targetSlug = currentTrack?.playlistSongSlug || currentTrack?.slug;
    if (!targetSlug) return;

    const res = await fetch("/api/playlists/toggle-favorite", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        userEmail: email,
        songSlug: targetSlug
      })
    });

    const data = await res.json();
    if (data?.ok) setIsSaved(Boolean(data.saved));
  }

  if (!isVisible || !currentTrack) return null;

  return (
    <>
      <audio ref={audioRef} />

      <div className={`global-player-shell ${isExpanded ? "is-expanded" : "is-collapsed"}`}>
        {isExpanded ? (
          <div className="global-player-card">
            <button
              className="global-player-collapse"
              onClick={() => setIsExpanded(false)}
              aria-label="Minimize player"
            >
              <IconMinimize />
            </button>

            <div className="global-player-main">
              <div className="global-player-copy">
                <div className="global-player-title">{trackParts.song}</div>
                <div className="global-player-artist">{trackParts.artist}</div>
              </div>

              <div className="global-player-controls">
                <button
                  onClick={togglePlaylistSave}
                  className={`gp-btn gp-btn-star ${isSaved ? "is-saved" : ""}`}
                  aria-label="Add to favorites"
                >
                  <IconStar filled={isSaved} />
                </button>

                <button onClick={playPrev} className="gp-btn" aria-label="Previous">
                  <IconPrev />
                </button>

                <button
                  onClick={() => {
                    if (!audioRef.current) return;
                    if (audioRef.current.paused) {
                      audioRef.current.play().catch(() => {});
                    } else {
                      audioRef.current.pause();
                    }
                  }}
                  className="gp-btn gp-btn-main"
                  aria-label="Play or pause"
                >
                  {isPlaying ? <IconPause /> : <IconPlay />}
                </button>

                <button onClick={playNext} className="gp-btn" aria-label="Next">
                  <IconNext />
                </button>
              </div>
            </div>
          </div>
        ) : (
          <button
            className="global-player-orb"
            onClick={() => setIsExpanded(true)}
            aria-label="Open player"
          >
            {isPlaying ? <IconPause /> : <IconPlay />}
          </button>
        )}
      </div>
    </>
  );
}
