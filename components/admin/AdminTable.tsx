import { supabaseAdmin } from "@/lib/supabase-admin";
const allowed = new Set(["songs","project_release_goals","kiiku_rules","nearby_share_sessions","purchases","stats_daily_rollups","app_users","admin_audit_logs"]);
export default async function AdminTable({ table }: { table: string }) {
  if (!allowed.has(table)) return <p className="muted">Not available.</p>;
  const rows = await supabaseAdmin.from(table).select("*").order("created_at", { ascending:false }).limit(20);
  return <div className="stack">{(rows.data || []).map((row:any)=><details className="kpi" key={row.id || JSON.stringify(row).slice(0,20)}><summary><strong>{row.name || row.title || row.email || row.rule_key || row.id}</strong><span className="badge">{row.status || table}</span></summary><pre className="small" style={{whiteSpace:'pre-wrap',overflow:'auto'}}>{JSON.stringify(row,null,2)}</pre></details>)}{!rows.data?.length ? <p className="muted">No records yet.</p> : null}</div>;
}
