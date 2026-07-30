import Link from "next/link";
import { requireAdminUser } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import "./admin.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function countRows(table: string) {
  try {
    const { count } = await supabaseAdmin.from(table).select("*", { count: "exact", head: true });
    return count || 0;
  } catch {
    return 0;
  }
}

const sections = [
  { title: "Accounts", href: "/dashboard/accounts", icon: "👤", copy: "Create users, roles, access, Kiiku, invites, and account controls." },
  { title: "Music", href: "/dashboard/music", icon: "♪", copy: "Control songs, favorites order, share status, projects, and app surfaces." },
  { title: "Songs", href: "/dashboard/songs", icon: "♫", copy: "Review song records, audio paths, unlocks, and publishing status." },
  { title: "Projects", href: "/dashboard/projects", icon: "▣", copy: "Manage app experiences, project goals, releases, and access mapping." },
  { title: "Share", href: "/dashboard/sharing", icon: "⌁", copy: "Nearby sessions, allowances, guest plays, and sharing health." },
  { title: "Kiiku", href: "/dashboard/kiiku", icon: "◎", copy: "Rules, transactions, campaigns, rewards, and manual adjustments." },
  { title: "Payments", href: "/dashboard/payments", icon: "$", copy: "Purchases, Stripe webhooks, refunds, and entitlement effects." },
  { title: "Stats", href: "/dashboard/stats", icon: "◉", copy: "Listening, Share, project support, and global activity." },
  { title: "Audit", href: "/dashboard/audit", icon: "✓", copy: "Admin actions, sensitive changes, and system records." },
];

export default async function DashboardPage() {
  const admin = await requireAdminUser();
  const [users, songs, purchases, shares] = await Promise.all([
    countRows("app_users"),
    countRows("songs"),
    countRows("purchases"),
    countRows("nearby_share_sessions"),
  ]);

  return (
    <main className="admin-os-page">
      <section className="admin-os-shell">
        <header className="admin-os-topbar">
          <Link href="/home" className="admin-os-pill">‹ Home</Link>
          <Link href="/apps/account" className="admin-os-pill">Account</Link>
        </header>

        <section className="admin-os-hero">
          <div>
            <p>Caliphornia OS Admin</p>
            <h1>Control Center</h1>
            <span>Signed in as {admin.email}. Manage the full platform from one place.</span>
          </div>
          <div className="admin-os-gear">⚙</div>
        </section>

        <section className="admin-os-kpis">
          <article><span>Users</span><strong>{users}</strong></article>
          <article><span>Songs</span><strong>{songs}</strong></article>
          <article><span>Purchases</span><strong>{purchases}</strong></article>
          <article><span>Shares</span><strong>{shares}</strong></article>
        </section>

        <section className="admin-os-grid">
          {sections.map((section) => (
            <Link href={section.href} className="admin-os-card" key={section.href}>
              <span>{section.icon}</span>
              <strong>{section.title}</strong>
              <small>{section.copy}</small>
            </Link>
          ))}
        </section>
      </section>
    </main>
  );
}
