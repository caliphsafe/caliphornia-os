import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySession } from "@/lib/session";
import { getUserAccess } from "@/lib/access";
import { supabaseAdmin } from "@/lib/supabase-admin";

const PROJECT_NAMES: Record<string, string> = {
  friends: "Fri.ends",
  fartherhood: "FarTHErHOOD",
  fatherhood: "FarTHErHOOD",
  milia: "Milia",
  music: "Music",
};

function formatDate(value?: string | null) {
  if (!value) return "No expiration";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
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

export default async function WalletPage() {
  const cookieStore = await cookies();
  const session = verifySession(cookieStore.get("caliph_os_session")?.value);

  if (!session?.email) {
    redirect("/");
  }

  const email = session.email.trim().toLowerCase();
  const access = await getUserAccess(email);

  const [projectAccessRes, passesRes, purchasesRes] = await Promise.all([
    supabaseAdmin
      .from("user_project_access")
      .select("project_slug, access_type, starts_at, expires_at, created_at")
      .eq("user_email", email)
      .order("created_at", { ascending: false }),

    supabaseAdmin
      .from("user_access_passes")
      .select("access_key, starts_at, expires_at, created_at")
      .eq("user_email", email)
      .order("created_at", { ascending: false }),

    supabaseAdmin
      .from("purchases")
      .select(
        "purchase_type, project_slug, access_key, amount_cents, currency, status, completed_at, expires_at, kiiku_credits, created_at"
      )
      .eq("user_email", email)
      .order("created_at", { ascending: false })
      .limit(25),
  ]);

  const projectRows = projectAccessRes.data || [];
  const passRows = passesRes.data || [];
  const purchaseRows = purchasesRes.data || [];

  const activePass = passRows.find((pass) => {
    if (pass.access_key !== "all_access") return false;
    if (!pass.expires_at) return true;
    return new Date(pass.expires_at).getTime() > Date.now();
  });

  const ownedProjects = projectRows.filter((row) => {
    if (!row.expires_at) return true;
    return new Date(row.expires_at).getTime() > Date.now();
  });

  const totalCreditsUsed = purchaseRows.reduce((total, purchase) => {
    return total + (purchase.kiiku_credits || 0);
  }, 0);

  return (
    <main className="wallet-page">
      <section className="wallet-shell">
        <div className="wallet-topbar">
          <Link href="/home" className="wallet-back">
            ← Home
          </Link>

          <img src="/icons/access.png" alt="" className="wallet-access-icon" />
        </div>

        <section className="wallet-hero-card">
          <p className="wallet-kicker">Kiiku Wallet</p>
          <h1>Your listening access</h1>
          <p>
            View your active pass, unlocked albums, Kiiku Credit activity, and
            Caliphornia OS account status.
          </p>

          <div className="wallet-account-pill">
            <span>Signed in as</span>
            <strong>{email}</strong>
          </div>
        </section>

        <section className="wallet-status-grid">
          <article className="wallet-status-card primary">
            <p>Kiiku Pass</p>
            <h2>{access.hasAllAccess || access.isFounder ? "Active" : "Not active"}</h2>
            <span>
              {activePass
                ? activePass.expires_at
                  ? `Ends ${formatDate(activePass.expires_at)}`
                  : "Full OS access is active"
                : "Unlock full access for 30 days or turn on monthly auto-renew"}
            </span>
          </article>

          <article className="wallet-status-card">
            <p>Unlocked albums</p>
            <h2>{ownedProjects.length}</h2>
            <span>Permanent project unlocks on this account</span>
          </article>

          <article className="wallet-status-card">
            <p>Kiiku Credits used</p>
            <h2>{totalCreditsUsed}</h2>
            <span>Listening credits spent through checkout</span>
          </article>
        </section>

        <section className="wallet-section">
          <div className="wallet-section-head">
            <div>
              <p className="wallet-kicker">Library Access</p>
              <h2>Unlocked albums</h2>
            </div>
          </div>

          {ownedProjects.length ? (
            <div className="wallet-unlocks">
              {ownedProjects.map((row) => (
                <article key={row.project_slug} className="wallet-unlock-card">
                  <div>
                    <p>{projectName(row.project_slug)}</p>
                    <h3>Album experience unlocked</h3>
                    <span>
                      Started {formatDate(row.starts_at)} ·{" "}
                      {row.expires_at
                        ? `Ends ${formatDate(row.expires_at)}`
                        : "Permanent access"}
                    </span>
                  </div>

                  <strong>Owned</strong>
                </article>
              ))}
            </div>
          ) : (
            <div className="wallet-empty-card">
              <h3>No albums unlocked yet</h3>
              <p>
                Open any Caliphornia OS app and use Kiiku Credits to unlock that
                album experience.
              </p>
            </div>
          )}
        </section>

        <section className="wallet-section">
          <div className="wallet-section-head">
            <div>
              <p className="wallet-kicker">Activity</p>
              <h2>Recent purchases</h2>
            </div>
          </div>

          {purchaseRows.length ? (
            <div className="wallet-history">
              {purchaseRows.map((purchase, index) => (
                <article key={`${purchase.created_at}-${index}`} className="wallet-history-row">
                  <div>
                    <p>
                      {purchase.purchase_type === "project"
                        ? projectName(purchase.project_slug)
                        : purchase.purchase_type === "kiiku_pass_30d"
                          ? "Kiiku Pass - 30 Days"
                          : purchase.purchase_type === "subscription"
                            ? "Kiiku Pass - Monthly"
                            : "Caliphornia OS Access"}
                    </p>
                    <span>
                      {purchase.kiiku_credits || 0} Kiiku Credits ·{" "}
                      {purchase.completed_at
                        ? formatDate(purchase.completed_at)
                        : formatDate(purchase.created_at)}
                    </span>
                  </div>

                  <div className="wallet-history-amount">
                    <strong>
                      {formatMoney(purchase.amount_cents, purchase.currency || "usd")}
                    </strong>
                    <span>{purchase.status}</span>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="wallet-empty-card">
              <h3>No purchase history yet</h3>
              <p>Your unlocks and Kiiku Pass purchases will appear here.</p>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
