import { supabaseAdmin } from "@/lib/supabase-admin";
export default async function CalendarPage() {
  const rows = await supabaseAdmin.from("calendar_events").select("*").in("status", ["scheduled", "live"]).order("display_date", { ascending:true }).limit(40);
  return <main className="shell stack"><header className="topbar"><div><span className="eyebrow">Calendar</span><h1 className="h1">Release dots</h1></div><a className="btn" href="/home">Home</a></header><section className="glass card stack">{(rows.data||[]).map((e:any)=><div className="kpi" key={e.id}><strong>{e.title}</strong><p className="small muted">{e.display_date || e.starts_at} · {e.event_type}</p></div>)}{!rows.data?.length ? <p className="muted">No scheduled releases yet.</p> : null}</section></main>;
}
