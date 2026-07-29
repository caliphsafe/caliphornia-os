import { requireCurrentAppUser } from "@/lib/users";
import { supabaseAdmin } from "@/lib/supabase-admin";

export default async function AccountPage() {
  const user = await requireCurrentAppUser();
  const [purchases, projectAccess, passes] = await Promise.all([
    supabaseAdmin.from("purchases").select("id,purchase_type,status,amount_cents,currency,created_at").or(`user_id.eq.${user.id},user_email.eq.${user.email}`).order("created_at", { ascending:false }).limit(10),
    supabaseAdmin.from("user_project_access").select("id,project_slug,status,expires_at,source_type").or(`user_id.eq.${user.id},user_email.eq.${user.email}`).limit(20),
    supabaseAdmin.from("user_access_passes").select("id,access_key,status,expires_at,source_type").or(`user_id.eq.${user.id},user_email.eq.${user.email}`).limit(20)
  ]);
  return <main className="shell stack"><header className="topbar"><div><span className="eyebrow">Account</span><h1 className="h1">{user.username || user.email}</h1></div><a className="btn" href="/home">Home</a></header><section className="glass card stack"><span className="eyebrow">Entitlements</span>{[...(projectAccess.data||[]),...(passes.data||[])].map((r:any)=><div className="kpi" key={r.id}><strong>{r.project_slug || r.access_key}</strong><p className="small muted">{r.status || 'active'} {r.expires_at ? `· expires ${new Date(r.expires_at).toLocaleDateString()}` : ''}</p></div>)}</section><section className="glass card stack"><span className="eyebrow">Purchases</span>{(purchases.data||[]).map((p:any)=><div className="kpi" key={p.id}><strong>{p.purchase_type || 'Purchase'}</strong><p className="small muted">{p.status} · {new Intl.NumberFormat('en-US',{style:'currency',currency:String(p.currency||'usd').toUpperCase()}).format(Number(p.amount_cents||0)/100)}</p></div>)}</section></main>;
}
