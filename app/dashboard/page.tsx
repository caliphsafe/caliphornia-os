const links = [
  ["Songs", "/dashboard/songs"], ["Projects", "/dashboard/projects"], ["Kiiku", "/dashboard/kiiku"], ["Sharing", "/dashboard/sharing"], ["Payments", "/dashboard/payments"], ["Stats", "/dashboard/stats"], ["Users", "/dashboard/users"], ["Audit", "/dashboard/audit"]
];
export default function DashboardPage() { return <main className="shell stack"><header className="topbar"><div><span className="eyebrow">Admin</span><h1 className="h1">Control Center</h1></div><a className="btn" href="/home">Home</a></header><section className="glass card"><div className="app-grid">{links.map(([label,href])=><a className="btn" href={href} key={href}>{label}</a>)}</div></section></main>; }
