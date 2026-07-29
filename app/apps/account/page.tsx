import Link from "next/link";
import { redirect } from "next/navigation";
import { readSession } from "@/lib/session";
import { getCurrentAppUser, getOrCreateAppUser } from "@/lib/users";
import { getUserAccess } from "@/lib/access";
import { getKiikuWallet } from "@/lib/kiiku/ledger";
import { supabaseAdmin } from "@/lib/supabase-admin";
import ManageBillingButton from "@/components/ManageBillingButton";
import "./settings.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const PROJECT_NAMES: Record<string, string> = {
  friends: "Fri.ends",
  fartherhood: "FarTHErHOOD",
  fatherhood: "FarTHErHOOD",
  milia: "Milia",
  music: "Music",
};

function formatDate(value?: string | null) {
  if (!value) return "No expiration";
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(value));
  } catch {
    return "No expiration";
  }
}

function formatMoney(amountCents?: number | null, currency = "usd") {
  if (typeof amountCents !== "number") return "$0.00";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amountCents / 100);
}

function projectName(slug?: string | null) {
  if (!slug) return "Caliphornia OS";
  return PROJECT_NAMES[slug] || slug;
}

function active(row: any) {
  if (!row) return false;
  if (row.status && !["active", "completed"].includes(String(row.status))) return false;
  if (!row.expires_at) return true;
  return new Date(row.expires_at).getTime() > Date.now();
}

async function safeRows(table: string, email: string, userId?: string) {
  try {
    let query = supabaseAdmin.from(table).select("*").order("created_at", { ascending: false });
    if (userId) query = query.or(`user_id.eq.${userId},user_email.eq.${email},user_email_snapshot.eq.${email}`);
    else query = query.eq("user_email", email);
    const { data } = await query.limit(50);
    return data || [];
  } catch {
    return [];
  }
}

export default async function AccountSettingsPage() {
  const session = await readSession();
  if (!session?.email) redirect("/");

  const email = session.email.trim().toLowerCase();
  const user =
    (await getCurrentAppUser().catch(() => null)) ||
    (await getOrCreateAppUser(email, session.username || null));

  const [access, wallet, projectRows, passRows, purchaseRows, shareRows] = await Promise.all([
    getUserAccess(email).catch(() => ({ hasAllAccess: false, hasMusicFull: false, isFounder: false, projectAccess: [] })),
    getKiikuWallet(user.id).catch(() => ({ available: 0, pending: 0, lifetimeEarned: 0, lifetimeSpent: 0 })),
    safeRows("user_project_access", email, user.id),
    safeRows("user_access_passes", email, user.id),
    safeRows("purchases", email, user.id),
    safeRows("sharing_allowances", email, user.id),
  ]);

  const ownedProjects = projectRows.filter(active);
  const activePasses = passRows.filter(active);
  const hasActivePass = Boolean(access.hasAllAccess || access.hasMusicFull || access.isFounder || activePasses.length);
  const billingProfile = purchaseRows.find((purchase: any) => purchase.stripe_customer_id);
  const shareTotal = shareRows.reduce((sum: number, row: any) => sum + Number(row.total_allowed || 0), 0);
  const shareRemaining = shareRows.reduce((sum: number, row: any) => sum + Number(row.remaining_count || 0), 0);

  return (
    <main className="settings-page">
      <section className="settings-phone">
        <header className="settings-topbar">
          <Link href="/home" className="settings-back">‹ Home</Link>
          <Link href="/apps/share" className="settings-share-link">Share</Link>
        </header>

        <section className="settings-hero">
          <div className="settings-avatar">{(user.username || email)[0]?.toUpperCase()}</div>
          <div>
            <p>Apple-style Settings</p>
            <h1>{user.username || "Account"}</h1>
            <span>{email}</span>
          </div>
        </section>

        <section className="settings-list">
          <details open className="settings-group">
            <summary>
              <span className="settings-icon blue">👤</span>
              <span>
                <strong>Profile</strong>
                <small>Your Caliphornia OS identity</small>
              </span>
            </summary>
            <div className="settings-panel">
              <div className="settings-row"><span>Email</span><strong>{email}</strong></div>
              <div className="settings-row"><span>Username</span><strong>{user.username || "Not set"}</strong></div>
              <div className="settings-row"><span>Role</span><strong>{user.role || "user"}</strong></div>
            </div>
          </details>

          <details open className="settings-group">
            <summary>
              <span className="settings-icon gold">◎</span>
              <span>
                <strong>Wallet</strong>
                <small>Kiiku, access, and unlocks</small>
              </span>
            </summary>
            <div className="settings-panel wallet-panel">
              <div className="settings-kpi"><span>Available Kiiku</span><strong>{wallet.available}</strong></div>
              <div className="settings-kpi"><span>Pending Kiiku</span><strong>{wallet.pending}</strong></div>
              <div className="settings-kpi"><span>Earned</span><strong>{wallet.lifetimeEarned}</strong></div>
              <div className="settings-kpi"><span>Spent</span><strong>{wallet.lifetimeSpent}</strong></div>
            </div>
          </details>

          <details className="settings-group">
            <summary>
              <span className="settings-icon green">✓</span>
              <span>
                <strong>Access</strong>
                <small>{hasActivePass ? "Pass active" : "No active full pass"}</small>
              </span>
            </summary>
            <div className="settings-panel">
              <div className="settings-row"><span>Full OS Pass</span><strong>{hasActivePass ? "Active" : "Not active"}</strong></div>
              <div className="settings-row"><span>Unlocked projects</span><strong>{ownedProjects.length}</strong></div>
              {ownedProjects.length ? (
                <div className="settings-stack">
                  {ownedProjects.map((row: any, index: number) => (
                    <div className="settings-mini-card" key={`${row.project_slug || row.project_id || index}`}>
                      <strong>{projectName(row.project_slug)}</strong>
                      <span>{row.expires_at ? `Until ${formatDate(row.expires_at)}` : "Permanent access"}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </details>

          <details className="settings-group">
            <summary>
              <span className="settings-icon cyan">⌁</span>
              <span>
                <strong>Share</strong>
                <small>{shareRemaining} of {shareTotal} shares available</small>
              </span>
            </summary>
            <div className="settings-panel">
              <div className="settings-row"><span>Available shares</span><strong>{shareRemaining}</strong></div>
              <div className="settings-row"><span>Total granted</span><strong>{shareTotal}</strong></div>
              <Link href="/apps/share" className="settings-action">Open Share</Link>
              <Link href="/apps/stats" className="settings-action secondary">View Stats</Link>
            </div>
          </details>

          <details className="settings-group">
            <summary>
              <span className="settings-icon purple">▣</span>
              <span>
                <strong>Billing</strong>
                <small>{billingProfile ? "Billing profile connected" : "No Stripe customer yet"}</small>
              </span>
            </summary>
            <div className="settings-panel">
              {billingProfile ? (
                <ManageBillingButton />
              ) : (
                <p className="settings-copy">The billing portal appears after a monthly Kiiku Pass has been started on this account.</p>
              )}
            </div>
          </details>

          <details className="settings-group">
            <summary>
              <span className="settings-icon red">$</span>
              <span>
                <strong>Purchase History</strong>
                <small>{purchaseRows.length} recent records</small>
              </span>
            </summary>
            <div className="settings-panel">
              {purchaseRows.length ? purchaseRows.slice(0, 12).map((purchase: any, index: number) => (
                <div className="settings-history" key={`${purchase.id || purchase.created_at || index}`}>
                  <div>
                    <strong>{projectName(purchase.project_slug) || purchase.purchase_type || "Caliphornia OS"}</strong>
                    <span>{formatDate(purchase.completed_at || purchase.created_at)}</span>
                  </div>
                  <div>
                    <strong>{formatMoney(purchase.amount_cents, purchase.currency || "usd")}</strong>
                    <span>{purchase.status || "completed"}</span>
                  </div>
                </div>
              )) : <p className="settings-copy">No purchase history yet.</p>}
            </div>
          </details>

          <details className="settings-group">
            <summary>
              <span className="settings-icon gray">?</span>
              <span>
                <strong>Support</strong>
                <small>Access or payment help</small>
              </span>
            </summary>
            <div className="settings-panel">
              <p className="settings-copy">If an unlock does not appear, email support with the account email above and the purchase you need help with.</p>
              <a href="mailto:caliph.safe@gmail.com" className="settings-action">caliph.safe@gmail.com</a>
            </div>
          </details>
        </section>
      </section>
    </main>
  );
}
