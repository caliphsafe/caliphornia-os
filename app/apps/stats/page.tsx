import { requireCurrentAppUser } from "@/lib/users";
import { getStats } from "@/lib/stats/queries";

export default async function StatsPage({ searchParams }: { searchParams?: Promise<{ range?: string }> }) {
  const params = await searchParams;
  const user = await requireCurrentAppUser();
  const stats = await getStats(user.id, params?.range || "30d");
  return <main className="shell stack"><header className="topbar"><div><span className="eyebrow">Stats</span><h1 className="h1">Activity</h1></div><a className="btn" href="/home">Home</a></header><div className="tabs"><a className="btn tab" href="?range=today">Today</a><a className="btn tab" href="?range=7d">7 days</a><a className="btn tab" href="?range=30d">30 days</a><a className="btn tab" href="?range=all">All time</a></div><section className="glass card stack"><span className="eyebrow">My Activity</span><div className="grid three">{Object.entries(stats.my).map(([k,v])=><div className="kpi" key={k}><span className="small muted">{k.replaceAll('_',' ')}</span><strong>{String(v)}</strong></div>)}</div></section><section className="glass card stack"><span className="eyebrow">Global Activity</span><div className="grid three">{Object.entries(stats.global).map(([k,v])=><div className="kpi" key={k}><span className="small muted">{k.replaceAll('_',' ')}</span><strong>{String(v)}</strong></div>)}</div></section></main>;
}
