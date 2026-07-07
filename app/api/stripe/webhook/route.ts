import Stripe from "stripe";
import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PurchaseRow = {
  id: string;
  user_email: string;
  purchase_type: string;
  project_slug: string | null;
  access_key: string | null;
  stripe_subscription_id: string | null;
};

function normalizeEmail(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

function normalizeValue(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

function nowIso() {
  return new Date().toISOString();
}

function getStripeId(
  value:
    | string
    | { id?: string | null }
    | null
    | undefined
) {
  if (!value) return null;
  if (typeof value === "string") return value;
  return value.id || null;
}

function secondsToIso(value: number | null | undefined) {
  if (!value) return null;
  return new Date(value * 1000).toISOString();
}

function getSubscriptionPeriodEnd(subscription: Stripe.Subscription) {
  const typedSubscription = subscription as Stripe.Subscription & {
    current_period_end?: number | null;
  };

  return typedSubscription.current_period_end || null;
}

function getInvoiceSubscriptionId(invoice: Stripe.Invoice) {
  const typedInvoice = invoice as Stripe.Invoice & {
    subscription?: string | { id?: string | null } | null;
    parent?: {
      subscription_details?: {
        subscription?: string | { id?: string | null } | null;
        metadata?: Stripe.Metadata | null;
      } | null;
    } | null;
  };

  return (
    getStripeId(typedInvoice.subscription) ||
    getStripeId(typedInvoice.parent?.subscription_details?.subscription)
  );
}

async function shouldProcessEvent(event: Stripe.Event) {
  const existingRes = await supabaseAdmin
    .from("stripe_webhook_events")
    .select("id, status")
    .eq("id", event.id)
    .maybeSingle();

  if (existingRes.data?.status === "processed") {
    return false;
  }

  if (existingRes.data) {
    const updateRes = await supabaseAdmin
      .from("stripe_webhook_events")
      .update({
        status: "processing",
        error_message: null,
      })
      .eq("id", event.id);

    if (updateRes.error) {
      throw new Error(updateRes.error.message);
    }

    return true;
  }

  const insertRes = await supabaseAdmin.from("stripe_webhook_events").insert({
    id: event.id,
    type: event.type,
    status: "processing",
  });

  if (insertRes.error) {
    throw new Error(insertRes.error.message);
  }

  return true;
}

async function markEventProcessed(event: Stripe.Event) {
  await supabaseAdmin
    .from("stripe_webhook_events")
    .update({
      status: "processed",
      processed_at: nowIso(),
      error_message: null,
    })
    .eq("id", event.id);
}

async function markEventFailed(event: Stripe.Event, error: unknown) {
  const message =
    error instanceof Error ? error.message : "Webhook processing failed.";

  await supabaseAdmin
    .from("stripe_webhook_events")
    .update({
      status: "failed",
      error_message: message,
    })
    .eq("id", event.id);
}

async function grantProjectAccess({
  userEmail,
  projectSlug,
}: {
  userEmail: string;
  projectSlug: string;
}) {
  const res = await supabaseAdmin.from("user_project_access").upsert(
    {
      user_email: userEmail,
      project_slug: projectSlug,
      access_type: "paid",
      starts_at: nowIso(),
      expires_at: null,
    },
    { onConflict: "user_email,project_slug" }
  );

  if (res.error) {
    throw new Error(res.error.message);
  }
}

async function grantThirtyDayPass({
  userEmail,
  accessKey,
  durationDays,
}: {
  userEmail: string;
  accessKey: string;
  durationDays: number;
}) {
  const existingRes = await supabaseAdmin
    .from("user_access_passes")
    .select("expires_at")
    .eq("user_email", userEmail)
    .eq("access_key", accessKey)
    .maybeSingle();

  if (existingRes.error) {
    throw new Error(existingRes.error.message);
  }

  const currentTime = Date.now();
  const existingExpiration = existingRes.data?.expires_at
    ? new Date(existingRes.data.expires_at).getTime()
    : 0;

  const baseTime =
    existingExpiration && existingExpiration > currentTime
      ? existingExpiration
      : currentTime;

  const expiresAt = new Date(
    baseTime + durationDays * 24 * 60 * 60 * 1000
  ).toISOString();

  const upsertRes = await supabaseAdmin.from("user_access_passes").upsert(
    {
      user_email: userEmail,
      access_key: accessKey,
      starts_at: nowIso(),
      expires_at: expiresAt,
    },
    { onConflict: "user_email,access_key" }
  );

  if (upsertRes.error) {
    throw new Error(upsertRes.error.message);
  }

  return expiresAt;
}

async function grantMonthlyPass({
  userEmail,
  accessKey,
}: {
  userEmail: string;
  accessKey: string;
}) {
  const res = await supabaseAdmin.from("user_access_passes").upsert(
    {
      user_email: userEmail,
      access_key: accessKey,
      starts_at: nowIso(),
      expires_at: null,
    },
    { onConflict: "user_email,access_key" }
  );

  if (res.error) {
    throw new Error(res.error.message);
  }
}

async function expireProjectAccess({
  userEmail,
  projectSlug,
}: {
  userEmail: string;
  projectSlug: string;
}) {
  const res = await supabaseAdmin
    .from("user_project_access")
    .update({
      expires_at: nowIso(),
    })
    .eq("user_email", userEmail)
    .eq("project_slug", projectSlug);

  if (res.error) {
    throw new Error(res.error.message);
  }
}

async function expireAccessPass({
  userEmail,
  accessKey,
  expiresAt = nowIso(),
}: {
  userEmail: string;
  accessKey: string;
  expiresAt?: string;
}) {
  const res = await supabaseAdmin
    .from("user_access_passes")
    .update({
      expires_at: expiresAt,
    })
    .eq("user_email", userEmail)
    .eq("access_key", accessKey);

  if (res.error) {
    throw new Error(res.error.message);
  }
}

async function findPurchaseByPaymentIntent(paymentIntentId: string) {
  const res = await supabaseAdmin
    .from("purchases")
    .select(
      "id, user_email, purchase_type, project_slug, access_key, stripe_subscription_id"
    )
    .eq("stripe_payment_intent_id", paymentIntentId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (res.error) {
    throw new Error(res.error.message);
  }

  return (res.data || null) as PurchaseRow | null;
}

async function findPurchaseBySubscription(subscriptionId: string) {
  const res = await supabaseAdmin
    .from("purchases")
    .select(
      "id, user_email, purchase_type, project_slug, access_key, stripe_subscription_id"
    )
    .eq("stripe_subscription_id", subscriptionId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (res.error) {
    throw new Error(res.error.message);
  }

  return (res.data || null) as PurchaseRow | null;
}

async function findPurchaseFromCharge(charge: Stripe.Charge) {
  const paymentIntentId = getStripeId(charge.payment_intent);

  if (paymentIntentId) {
    const purchase = await findPurchaseByPaymentIntent(paymentIntentId);

    if (purchase) {
      return purchase;
    }
  }

  const invoiceId = getStripeId(charge.invoice);

  if (!invoiceId) {
    return null;
  }

  const invoice = await stripe.invoices.retrieve(invoiceId);
  const subscriptionId = getInvoiceSubscriptionId(invoice);

  if (!subscriptionId) {
    return null;
  }

  return findPurchaseBySubscription(subscriptionId);
}

async function revokePurchaseAccess(purchase: PurchaseRow) {
  const userEmail = normalizeEmail(purchase.user_email);
  const purchaseType = normalizeValue(purchase.purchase_type);
  const projectSlug = normalizeValue(purchase.project_slug);
  const accessKey = normalizeValue(purchase.access_key || "all_access");

  if (!userEmail) return;

  if (purchaseType === "project" && projectSlug) {
    await expireProjectAccess({
      userEmail,
      projectSlug,
    });

    return;
  }

  if (
    purchaseType === "kiiku_pass_30d" ||
    purchaseType === "subscription" ||
    accessKey
  ) {
    await expireAccessPass({
      userEmail,
      accessKey: accessKey || "all_access",
    });
  }
}

async function updatePurchaseStatus({
  purchaseId,
  status,
}: {
  purchaseId: string;
  status: string;
}) {
  const res = await supabaseAdmin
    .from("purchases")
    .update({
      status,
    })
    .eq("id", purchaseId);

  if (res.error) {
    throw new Error(res.error.message);
  }
}

async function resolveSubscriptionIdentity({
  subscriptionId,
  metadata,
}: {
  subscriptionId: string;
  metadata: Stripe.Metadata | null | undefined;
}) {
  const userEmailFromMetadata = normalizeEmail(metadata?.user_email);
  const accessKeyFromMetadata = normalizeValue(metadata?.access_key || "all_access");

  if (userEmailFromMetadata) {
    return {
      userEmail: userEmailFromMetadata,
      accessKey: accessKeyFromMetadata || "all_access",
    };
  }

  const purchase = await findPurchaseBySubscription(subscriptionId);

  if (!purchase) {
    return null;
  }

  return {
    userEmail: normalizeEmail(purchase.user_email),
    accessKey: normalizeValue(purchase.access_key || "all_access"),
  };
}

async function syncSubscriptionAccess(subscription: Stripe.Subscription) {
  const subscriptionId = subscription.id;

  const identity = await resolveSubscriptionIdentity({
    subscriptionId,
    metadata: subscription.metadata,
  });

  if (!identity?.userEmail) {
    return;
  }

  const status = subscription.status;
  const periodEndIso = secondsToIso(getSubscriptionPeriodEnd(subscription));
  const typedSubscription = subscription as Stripe.Subscription & {
    cancel_at_period_end?: boolean | null;
  };

  let expiresAt: string | null = null;

  if (status === "active" || status === "trialing") {
    expiresAt = typedSubscription.cancel_at_period_end
      ? periodEndIso || nowIso()
      : null;
  } else if (
    status === "past_due" ||
    status === "unpaid" ||
    status === "incomplete"
  ) {
    expiresAt = periodEndIso || nowIso();
  } else {
    expiresAt = nowIso();
  }

  const passRes = await supabaseAdmin.from("user_access_passes").upsert(
    {
      user_email: identity.userEmail,
      access_key: identity.accessKey || "all_access",
      starts_at: nowIso(),
      expires_at: expiresAt,
    },
    { onConflict: "user_email,access_key" }
  );

  if (passRes.error) {
    throw new Error(passRes.error.message);
  }

  const purchaseStatus =
    status === "active" || status === "trialing" ? "completed" : status;

  const purchaseRes = await supabaseAdmin
    .from("purchases")
    .update({
      status: purchaseStatus,
      expires_at: expiresAt,
    })
    .eq("stripe_subscription_id", subscriptionId);

  if (purchaseRes.error) {
    throw new Error(purchaseRes.error.message);
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const metadata = session.metadata || {};
  const purchaseType = normalizeValue(metadata.purchase_type);
  const userEmail = normalizeEmail(
    metadata.user_email ||
      session.customer_details?.email ||
      session.customer_email
  );

  if (!userEmail) {
    throw new Error("Missing user email on checkout session.");
  }

  const projectSlug = normalizeValue(metadata.project_slug);
  const accessKey = normalizeValue(metadata.access_key || "all_access");
  const paymentIntentId = getStripeId(session.payment_intent);
  const subscriptionId = getStripeId(session.subscription);
  const kiikuCredits = Number(metadata.kiiku_credits || 0) || null;
  const durationDays = Number(metadata.duration_days || 30) || 30;

  let expiresAt: string | null = null;

  if (purchaseType === "project") {
    if (!projectSlug) {
      throw new Error("Missing project slug for project purchase.");
    }

    await grantProjectAccess({
      userEmail,
      projectSlug,
    });
  }

  if (purchaseType === "kiiku_pass_30d") {
    expiresAt = await grantThirtyDayPass({
      userEmail,
      accessKey: accessKey || "all_access",
      durationDays,
    });
  }

  if (purchaseType === "subscription") {
    await grantMonthlyPass({
      userEmail,
      accessKey: accessKey || "all_access",
    });
  }

  const purchaseRes = await supabaseAdmin.from("purchases").upsert(
    {
      user_email: userEmail,
      purchase_type: purchaseType,
      project_slug: projectSlug || null,
      access_key: accessKey || null,
      stripe_checkout_session_id: session.id,
      stripe_payment_intent_id: paymentIntentId,
      stripe_subscription_id: subscriptionId,
      amount_cents: session.amount_total,
      currency: session.currency || "usd",
      status: "completed",
      completed_at: nowIso(),
      expires_at: expiresAt,
      kiiku_credits: kiikuCredits,
    },
    { onConflict: "stripe_checkout_session_id" }
  );

  if (purchaseRes.error) {
    throw new Error(purchaseRes.error.message);
  }

  if (purchaseType === "subscription" && subscriptionId) {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    await syncSubscriptionAccess(subscription);
  }
}

async function handleInvoiceSubscriptionSync(invoice: Stripe.Invoice) {
  const subscriptionId = getInvoiceSubscriptionId(invoice);

  if (!subscriptionId) {
    return;
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  await syncSubscriptionAccess(subscription);
}

async function handleRefundedCharge(charge: Stripe.Charge) {
  const amount = charge.amount || 0;
  const amountRefunded = charge.amount_refunded || 0;

  if (amount > 0 && amountRefunded < amount) {
    return;
  }

  const purchase = await findPurchaseFromCharge(charge);

  if (!purchase) {
    return;
  }

  await revokePurchaseAccess(purchase);
  await updatePurchaseStatus({
    purchaseId: purchase.id,
    status: "refunded",
  });
}

async function handleDisputeCreated(dispute: Stripe.Dispute) {
  const chargeId = getStripeId(dispute.charge);

  if (!chargeId) {
    return;
  }

  const charge = await stripe.charges.retrieve(chargeId);

  if (charge.deleted) {
    return;
  }

  const purchase = await findPurchaseFromCharge(charge);

  if (!purchase) {
    return;
  }

  await revokePurchaseAccess(purchase);
  await updatePurchaseStatus({
    purchaseId: purchase.id,
    status: "disputed",
  });
}

export async function POST(req: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    return NextResponse.json(
      { ok: false, error: "Missing STRIPE_WEBHOOK_SECRET." },
      { status: 500 }
    );
  }

  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { ok: false, error: "Missing Stripe signature." },
      { status: 400 }
    );
  }

  const rawBody = await req.text();

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      webhookSecret
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Invalid webhook signature.";

    return NextResponse.json(
      { ok: false, error: message },
      { status: 400 }
    );
  }

  try {
    const shouldProcess = await shouldProcessEvent(event);

    if (!shouldProcess) {
      return NextResponse.json({
        received: true,
        duplicate: true,
      });
    }

    switch (event.type) {
      case "checkout.session.completed": {
        await handleCheckoutCompleted(
          event.data.object as Stripe.Checkout.Session
        );
        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        await syncSubscriptionAccess(event.data.object as Stripe.Subscription);
        break;
      }

      case "invoice.paid":
      case "invoice.payment_failed": {
        await handleInvoiceSubscriptionSync(event.data.object as Stripe.Invoice);
        break;
      }

      case "charge.refunded": {
        await handleRefundedCharge(event.data.object as Stripe.Charge);
        break;
      }

      case "charge.dispute.created": {
        await handleDisputeCreated(event.data.object as Stripe.Dispute);
        break;
      }

      default: {
        break;
      }
    }

    await markEventProcessed(event);

    return NextResponse.json({
      received: true,
    });
  } catch (error) {
    await markEventFailed(event, error);

    const message =
      error instanceof Error ? error.message : "Webhook processing failed.";

    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}
