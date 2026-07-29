"use client";
import { useEffect, useRef, useState } from "react";

export default function GuestPlayer({ token }: { token: string }) {
  const [data, setData] = useState<any>(null);
  const [claimEmail, setClaimEmail] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const audio = useRef<HTMLAudioElement|null>(null);
  useEffect(()=>{ fetch(`/api/guest/audio-url?guestToken=${encodeURIComponent(token)}`).then(r=>r.json()).then(setData); },[token]);
  async function startClaim() { const r = await fetch('/api/guest/claim/start',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({guestToken:token,email:claimEmail})}); const d=await r.json(); setMessage(d.devCode ? `Code sent. Dev code: ${d.devCode}` : (d.ok?'Code sent.':d.error)); }
  async function verify() { const r = await fetch('/api/guest/claim/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({guestToken:token,email:claimEmail,code})}); const d=await r.json(); if(d.ok) window.location.href='/apps/music'; else setMessage(d.error); }
  return <main className="shell stack"><section className="glass card stack"><span className="eyebrow">Shared nearby</span><h1 className="h1">{data?.song?.title || 'One full play'}</h1>{data?.playbackUrl ? <audio ref={audio} src={data.playbackUrl} controls autoPlay controlsList="nodownload noplaybackrate" style={{width:'100%'}} onEnded={()=>fetch('/api/guest/playback/complete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({guestToken:token})}).then(()=>setMessage('Keep this song in your Caliphornia Music library.'))} /> : <p className="muted">{data?.error || 'Preparing your guest play...'}</p>}</section><section className="glass card stack"><span className="eyebrow">Claim experience</span><h2 className="h2">Keep this song in your Caliphornia Music library.</h2><p className="muted">Enter your email after listening. No unnecessary profile setup required.</p><input className="input" type="email" placeholder="Email" value={claimEmail} onChange={e=>setClaimEmail(e.target.value)} /><button className="btn primary" onClick={startClaim}>Send code</button><input className="input" placeholder="One-time code" value={code} onChange={e=>setCode(e.target.value)} /><button className="btn kiiku" onClick={verify}>Verify and open Music</button>{message ? <p className="muted">{message}</p> : null}</section></main>;
}
