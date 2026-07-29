import { supabaseAdmin } from "@/lib/supabase-admin";
export default async function ThreadPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const thread = await supabaseAdmin.from("conversations").select("*,conversation_messages(*)").eq("slug", slug).maybeSingle();
  return <main className="shell stack"><header className="topbar"><div><span className="eyebrow">fri.ends</span><h1 className="h1">{thread.data?.title || slug}</h1></div><a className="btn" href="/apps/friends">Back</a></header><section className="glass card stack">{(thread.data?.conversation_messages||[]).map((m:any)=><div className="kpi" key={m.id}><p>{m.body || m.text || 'Message'}</p></div>)}{!thread.data ? <p className="muted">Thread not found.</p> : null}</section></main>;
}
