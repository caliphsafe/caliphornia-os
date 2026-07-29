"use client";
import { useState } from "react";

export default function NearbyClient({ signedIn }: { signedIn: boolean }) {
  const [mode, setMode] = useState<"idle"|"send"|"receive">("idle");
  const [songSlug, setSongSlug] = useState("");
  const [session, setSession] = useState<any>(null);
  const [message, setMessage] = useState("");

  async function share() {
    setMessage("Creating nearby share...");
    const res = await fetch("/api/nearby/share/start", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ songSlug }) });
    const data = await res.json();
    setSession(data); setMessage(data.ok ? "Share session created. Ask them to tap Receive Nearby." : data.error);
  }
  async function receive() {
    setMessage("Looking for nearby shares...");
    const res = await fetch("/api/nearby/receive/start", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ deviceLabel:"Nearby listener" }) });
    const data = await res.json();
    setSession(data); setMessage(data.ok ? "Receive session ready. Searching..." : data.error);
  }
  async function findCandidates() {
    const res = await fetch(`/api/nearby/receive/candidates?guestToken=${encodeURIComponent(session.guestToken || "")}`);
    const data = await res.json(); setSession({ ...session, candidates:data.candidates || [] }); setMessage(data.candidates?.length ? "Nearby sessions found." : "No sessions found. Use the phrase fallback.");
  }
  async function accept(id: string) {
    const res = await fetch("/api/nearby/receive/confirm", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ guestToken:session.guestToken, shareSessionId:id }) });
    const data = await res.json(); setSession({ ...session, ...data }); setMessage(data.ok ? "Share accepted. Waiting for sender confirmation." : data.error);
  }
  return <main className="shell stack"><header className="topbar"><div><span className="eyebrow">Nearby Sharing</span><h1 className="h1">No QR. Just nearby.</h1></div><a className="btn" href="/home">Home</a></header><section className="glass card stack"><p className="muted">Nearby Sharing uses temporary session timing, optional location permission, confirmation, and short-lived phrases. It does not claim exact indoor distance.</p>{mode==='idle' ? <div className="grid two"><button className="btn primary" disabled={!signedIn} onClick={()=>setMode('send')}>Share Nearby</button><button className="btn" onClick={()=>setMode('receive')}>Receive Nearby</button></div> : null}{mode==='send' ? <div className="stack"><input className="input" placeholder="Song slug, for example story-time" value={songSlug} onChange={(e)=>setSongSlug(e.target.value)} /><button className="btn primary" onClick={share}>Create Share Session</button>{session?.phrase ? <div className="kpi"><span className="small muted">Fallback phrase</span><strong>{session.phrase}</strong><p className="small muted">This phrase expires quickly and does not grant access by itself.</p></div> : null}</div> : null}{mode==='receive' ? <div className="stack"><button className="btn primary" onClick={receive}>Start Receive Nearby</button>{session?.guestToken ? <button className="btn" onClick={findCandidates}>Find Nearby Shares</button> : null}{session?.candidates?.map((c:any)=><div className="kpi" key={c.id}><strong>{c.song_title || 'Nearby song'}</strong><p className="small muted">From {c.sender_label || 'Nearby listener'}</p><button className="btn primary" onClick={()=>accept(c.id)}>Accept</button></div>)}</div> : null}{message ? <p className="muted">{message}</p> : null}{session?.guestUrl ? <a className="btn kiiku" href={session.guestUrl}>Open guest play</a> : null}</section></main>;
}
