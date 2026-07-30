import Link from "next/link";
import { requireAdminUser } from "@/lib/admin-auth";
import "./admin.css";

const adminLinks = [
  ["Overview", "/dashboard"],
  ["Songs", "/dashboard/songs"],
  ["Import Song", "/dashboard/import-song"],
  ["Fri.ends Builder", "/dashboard/friends-builder"],
  ["Experiences", "/dashboard/experiences"],
  ["Accounts", "/dashboard/accounts"],
  ["Kiiku", "/dashboard/kiiku"],
  ["Invites", "/dashboard/invites"],
  ["Blasts", "/dashboard/blasts"],
  ["Sharing", "/dashboard/sharing"],
  ["Payments", "/dashboard/payments"],
  ["Stats", "/dashboard/stats"],
  ["Audit", "/dashboard/audit"],
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdminUser();

  return (
    <main className="admin-os-page">
      <section className="admin-os-shell">
        <header className="admin-os-topbar">
          <div>
            <p>Caliphornia OS</p>
            <h1>Admin Control</h1>
            <span>{admin.email}</span>
          </div>
          <div className="admin-os-top-actions">
            <Link href="/home">Home</Link>
            <Link href="/apps/music">Music</Link>
            <Link href="/apps/account">Account</Link>
          </div>
        </header>

        <nav className="admin-os-nav" aria-label="Admin sections">
          {adminLinks.map(([label, href]) => (
            <Link key={href} href={href}>{label}</Link>
          ))}
        </nav>

        {children}
      </section>
    </main>
  );
}
