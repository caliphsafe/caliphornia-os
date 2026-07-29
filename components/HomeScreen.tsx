import { appRegistry } from "@/lib/app-registry";
import AppIcon from "@/components/AppIcon";
import type { AppUser } from "@/types/domain";

export default function HomeScreen({ user }: { user: AppUser }) {
  return (
    <main className="shell stack">
      <header className="topbar">
        <div>
          <span className="eyebrow">Caliphornia OS</span>
          <h1 className="h2">Welcome{user.username ? `, ${user.username}` : ""}</h1>
        </div>
        <a className="btn" href="/apps/account">Account</a>
      </header>
      <section className="glass card stack">
        <p className="muted">Music, sharing, Kiiku, project releases, and Stats now move through one connected OS.</p>
        <div className="app-grid">
          {appRegistry.map((app) => <AppIcon key={app.id} app={app} />)}
        </div>
      </section>
    </main>
  );
}
