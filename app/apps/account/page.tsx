import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySession } from "@/lib/session";
import { getUserAccess } from "@/lib/access";
import { supabaseAdmin } from "@/lib/supabase-admin";
import AccountProfileForm from "@/components/AccountProfileForm";
import ManageBillingButton from "@/components/ManageBillingButton";

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

function purchaseName(purchase: {
  purchase_type?: string | null;
  project_slug?: string | null;
}) {
  if (purchase.purchase_type === "project") {
    return projectName(purchase.project_slug);
  }

  if (purchase.purchase_type === "kiiku_pass_30d") {
    return "Kiiku Pass - 30 Days";
  }

  if (purchase.purchase_type === "subscription") {
    return "Kiiku Pass - Monthly";
  }

  return "Caliphornia OS Access";
}

function purchaseAccessLabel(purchase: {
  purchase_type?: string | null;
  status?: string | null;
}) {
  if (purchase.status === "refunded") return "Refunded";
  if (purchase.status === "disputed") return "Disputed";
  if (purchase.status === "canceled") return "Canceled";
  if (purchase.status === "past_due") return "Past due";
  if (purchase.status === "unpaid") return "Unpaid";

  if (purchase.purchase_type === "project") return "Album unlock";
  if (purchase.purchase_type === "kiiku_pass_30d") return "30-day pass";
  if (purchase.purchase_type === "subscription") return "Monthly pass";

  return "Access";
}

export default async function AccountPage() {
  const cookieStore = await cookies();
  const session = verifySession(cookieStore.get("caliph_os_session")?.value);

  if (!session?.email) {
    redirect("/");
  }

  const email = session.email.trim().toLowerCase();
  const access = await getUserAccess(email);

  const [userRes, projectAccessRes, passesRes, purchasesRes] = await Promise.all([
    supabaseAdmin
      .from("app_users")
      .select("email, username, role")
      .eq("email", email)
      .maybeSingle(),

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
        "purchase_type, project_slug, access_key, amount_cents, currency, status, completed_at, expires_at, kiiku_credits, stripe_subscription_id, stripe_customer_id, created_at"
      )
      .eq("user_email", email)
      .order("created_at", { ascending: false })
      .limit(25),
  ]);

  const user = userRes.data;
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

  const monthlyPurchase = purchaseRows.find((purchase) => {
    return (
      purchase.purchase_type === "subscription" &&
      purchase.status !== "canceled" &&
      purchase.status !== "refunded" &&
      purchase.status !== "disputed"
    );
  });

  const activeThirtyDayPurchase = purchaseRows.find((purchase) => {
    return (
      purchase.purchase_type === "kiiku_pass_30d" &&
      purchase.status === "completed" &&
      purchase.expires_at &&
      new Date(purchase.expires_at).getTime() > Date.now()
    );
  });

  const hasMonthlyBillingProfile = Boolean(
    monthlyPurchase?.stripe_subscription_id || monthlyPurchase?.stripe_customer_id
  );

  const hasActivePass = Boolean(access.hasAllAccess || access.isFounder);
  const passType = hasActivePass
    ? monthlyPurchase && activePass?.expires_at === null
      ? "Monthly Kiiku Pass"
      : activeThirtyDayPurchase || activePass?.expires_at
        ? "30-Day Kiiku Pass"
        : "Full OS Access"
    : "No active pass";

  const passDescription = hasActivePass
    ? activePass?.expires_at
      ? `Active until ${formatDate(activePass.expires_at)}`
      : monthlyPurchase
        ? "Monthly access is active on this account."
        : "Full OS access is active on this account."
    : "Unlock full access for 30 days or turn on monthly access from any app.";

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
          <p className="wallet-kicker">Account</p>
          <h1>Your Caliphornia OS account</h1>
          <p>
            Manage your profile, view unlocked albums, check Kiiku Pass status,
            and review your listening credit purchases.
          </p>

          <div className="wallet-account-pill">
            <span>Signed in as</span>
            <strong>{email}</strong>
          </div>
        </section>

        <section className="wallet-section">
          <div className="wallet-section-head">
            <div>
              <p className="wallet-kicker">Profile</p>
              <h2>Account info</h2>
            </div>
          </div>

          <AccountProfileForm
            email={email}
            initialUsername={user?.username || ""}
          />
        </section>

        <section className="wallet-status-grid">
          <article className="wallet-status-card primary">
            <p>Kiiku Pass</p>
            <h2>{hasActivePass ? "Active" : "Not active"}</h2>
            <span>{passDescription}</span>
          </article>

          <article className="wallet-status-card">
            <p>Pass type</p>
            <h2>{passType}</h2>
            <span>
              {monthlyPurchase
                ? "Monthly billing profile found"
                : activePass?.expires_at
                  ? "One-time 30-day access"
                  : "No monthly billing active"}
            </span>
          </article>

          <article className="wallet-status-card">
            <p>Unlocked albums</p>
            <h2>{ownedProjects.length}</h2>
            <span>Permanent album unlocks on this account</span>
          </article>

          <article className="wallet-status-card">
            <p>Kiiku Credits used</p>
            <h2>{totalCreditsUsed}</h2>
            <span>Listening credits used through checkout</span>
          </article>
        </section>

        <section className="wallet-section">
          <div className="wallet-section-head">
            <div>
              <p className="wallet-kicker">Billing</p>
              <h2>Subscription management</h2>
            </div>
          </div>

          <div className="wallet-billing-card">
            <div>
              <h3>Monthly Kiiku Pass</h3>
              <p>
                Manage billing, payment method, invoices, or cancellation for a
                monthly Kiiku Pass.
              </p>
            </div>

            {hasMonthlyBillingProfile ? (
              <ManageBillingButton />
            ) : (
              <div className="wallet-billing-note">
                <strong>No monthly billing found</strong>
                <span>
                  The billing portal appears after a monthly Kiiku Pass has been
                  started on this account.
                </span>
              </div>
            )}
          </div>
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
                <article
                  key={`${purchase.created_at}-${index}`}
                  className="wallet-history-row"
                >
                  <div>
                    <p>{purchaseName(purchase)}</p>
                    <span>
                      {purchase.kiiku_credits || 0} Kiiku Credits ·{" "}
                      {purchase.completed_at
                        ? formatDate(purchase.completed_at)
                        : formatDate(purchase.created_at)}
                    </span>
                  </div>

                  <div className="wallet-history-amount">
                    <strong>
                      {formatMoney(
                        purchase.amount_cents,
                        purchase.currency || "usd"
                      )}
                    </strong>
                    <span>{purchaseAccessLabel(purchase)}</span>
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

        <section className="wallet-section">
          <div className="wallet-section-head">
            <div>
              <p className="wallet-kicker">Support</p>
              <h2>Access help</h2>
            </div>
          </div>

          <div className="wallet-support-card">
            <h3>Need help with your access?</h3>
            <p>
              If something you purchased does not appear unlocked, email support
              with the account email shown above and the purchase you need help
              with.
            </p>

            <a href="mailto:caliph.safe@gmail.com">caliph.safe@gmail.com</a>
          </div>
        </section>
      </section>
    </main>
  );
}
