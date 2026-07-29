import { requireCurrentAppUser } from "@/lib/users";
import { getKiikuWallet } from "@/lib/kiiku/ledger";

export default async function WalletPage() {
  const user = await requireCurrentAppUser();
  const wallet = await getKiikuWallet(user.id);
  return (
    <main className="shell stack">
      <header className="topbar"><div><span className="eyebrow">Kiiku</span><h1 className="h1">Wallet</h1></div><a className="btn" href="/home">Home</a></header>
      <section className="grid two">
        <div className="kpi"><span className="small muted">Available Kiiku</span><strong>{wallet.available}</strong></div>
        <div className="kpi"><span className="small muted">Pending Kiiku</span><strong>{wallet.pending}</strong></div>
        <div className="kpi"><span className="small muted">Lifetime earned</span><strong>{wallet.lifetimeEarned}</strong></div>
        <div className="kpi"><span className="small muted">Lifetime spent</span><strong>{wallet.lifetimeSpent}</strong></div>
      </section>
      <section className="glass card stack"><span className="eyebrow">Recent activity</span>{wallet.recent.length ? wallet.recent.map((r:any,i:number)=><div className="kpi" key={i}><strong>{r.direction === 'spend' ? '-' : '+'}{r.amount} Kiiku</strong><p className="small muted">{r.reason || r.transaction_type}</p></div>) : <p className="muted">No Kiiku activity yet.</p>}</section>
    </main>
  );
}
