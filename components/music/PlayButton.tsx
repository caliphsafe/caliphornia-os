"use client";
export default function PlayButton({ songId, songSlug, title, artist }: { songId?: string; songSlug?: string; title: string; artist?: string }) {
  return <button className="btn primary" onClick={() => window.postMessage({ type:"CALIPH_PLAY", track: { songId, songSlug, title, artist } }, "*")}>Play</button>;
}
