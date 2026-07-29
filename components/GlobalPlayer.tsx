"use client";
import { useEffect, useRef, useState } from "react";

type Track = { songId?: string; songSlug?: string; title: string; artist?: string; playbackUrl?: string; access?: string; clipStart?: number | null; clipEnd?: number | null };

export default function GlobalPlayer() {
  const [track, setTrack] = useState<Track | null>(null);
  const [error, setError] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const sessionRef = useRef<string | null>(null);

  useEffect(() => {
    async function handler(event: MessageEvent) {
      if (event.data?.type !== "CALIPH_PLAY") return;
      setError("");
      const payload = event.data.track as Track;
      const res = await fetch("/api/playback/start", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ songId: payload.songId, songSlug: payload.songSlug }) });
      const data = await res.json();
      if (!data.ok) { setError(data.error || "Playback unavailable."); return; }
      sessionRef.current = data.playbackSessionId;
      setTrack({ ...payload, playbackUrl: data.playbackUrl, access: data.access?.displayLabel, clipStart: data.access?.previewStartSeconds, clipEnd: data.access?.previewEndSeconds });
      setTimeout(()=>audioRef.current?.play().catch(()=>{}), 50);
    }
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !track) return;
    if (typeof track.clipStart === "number") audio.currentTime = track.clipStart;
    const interval = setInterval(() => {
      if (!sessionRef.current || audio.paused) return;
      fetch("/api/playback/heartbeat", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ playbackSessionId: sessionRef.current, secondsPlayed: Math.floor(audio.currentTime) }) });
      if (typeof track.clipEnd === "number" && audio.currentTime >= track.clipEnd) audio.pause();
    }, 5000);
    return () => clearInterval(interval);
  }, [track]);

  if (!track && !error) return null;
  return (
    <div className="player glass">
      {error ? <p className="small" style={{color:"var(--danger)", margin:0}}>{error}</p> : null}
      {track ? <>
        <div className="player-row"><div><strong>{track.title}</strong><div className="small muted">{track.artist || "Caliph"} · {track.access || "Playing"}</div></div><button className="btn" onClick={()=>audioRef.current?.paused ? audioRef.current.play() : audioRef.current?.pause()}>Play/Pause</button></div>
        <audio ref={audioRef} src={track.playbackUrl} controls controlsList="nodownload noplaybackrate" style={{width:"100%"}} onEnded={()=> sessionRef.current && fetch("/api/playback/end", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ playbackSessionId: sessionRef.current }) })} />
      </> : null}
    </div>
  );
}
