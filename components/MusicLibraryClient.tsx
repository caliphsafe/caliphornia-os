"use client";
import { useEffect, useState } from "react";
import PlayButton from "@/components/music/PlayButton";

type Row = { id:string; song_id:string; song_slug:string; title:string; artist:string; label:string; status:string };

export default function MusicLibraryClient({ userId }: { userId: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { fetch("/api/music/favorites").then(r=>r.json()).then(d=>{ setRows(d.songs || []); setLoading(false); }); }, []);
  return (
    <main className="shell stack">
      <header className="topbar"><div><span className="eyebrow">Caliphornia Music</span><h1 className="h1">Library</h1></div><a className="btn" href="/home">Home</a></header>
      <section className="glass card stack">
        <p className="muted">Saved, owned, unlocked, and shared songs live together here without duplicate library entries.</p>
        {loading ? <p className="muted">Loading your Music...</p> : null}
        {!loading && !rows.length ? <p className="muted">Your Music library is empty. Play or save songs across Caliphornia OS to build it.</p> : null}
        <div className="grid">
          {rows.map((row) => <div className="kpi" key={row.id}><strong>{row.title}</strong><p className="small muted">{row.artist || "Caliph"} · {row.label}</p><PlayButton songId={row.song_id} songSlug={row.song_slug} title={row.title} artist={row.artist} /></div>)}
        </div>
      </section>
    </main>
  );
}
