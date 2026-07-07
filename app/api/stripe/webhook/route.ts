import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";
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

function normalizeValue(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function nowIso() {
  return new Date().toISOString();
}

function addDaysFrom(base: number, days: number) {
  return new Date(base + days * 24 * 60 * 60 * 1000).toISOString();
}

function getStripeId(
  value: string | { id?: string | null } | null | undefined
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

  if (existingRes.error) {
    throw new Error(existingRes.error.message);
  }

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
  const res = await supabaseAdmin
    .from("stripe_webhook_events")
    .update({
      status: "processed",
      processed_at: nowIso(),
      error_message: null,
    })
    .eq("id", event.id);

  if (res.error) {
    throw new Error(res.error.message);
  }
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

async function getExtendedPassExpiration({
  userEmail,
  accessKey,
  days,
}: {
  userEmail: string;
  accessKey: string;
  days: number;
}) {
  const now = Date.now();

  const existingRes = await supabaseAdmin
    .from("user_access_passes")
    .select("expires_at")
    .eq("user_email", userEmail)
    .eq("access_key", accessKey)
    .maybeSingle();

  if (existingRes.error) {
    throw new Error(existingRes.error.message);
  }

  const existing = existingRes.data;

  if (existing && existing.expires_at === null) {
    return null;
  }

  const existingExpiresAt = existing?.expires_at
    ? new Date(existing.expires_at).getTime()
    : 0;

  const base = Math.max(now, existingExpiresAt);

  return addDaysFrom(base, days);
}

async function recordCompletedPurchase({
  session,
  expiresAt,
}: {
  session: Stripe.Checkout.Session;
  expiresAt?: string | null;
}) {
  const metadata = session.metadata || {};
  const userEmail = normalizeValue(
    metadata.user_email ||
      session.customer_details?.email ||
      session.customer_email
  );
  const purchaseType = normalizeValue(metadata.purchase_type);
  const projectSlug = normalizeValue(metadata.project_slug);
  const accessKey = normalizeValue(metadata.access_key);
  const kiikuCredits = Number(metadata.kiiku_credits || 0) || null;

  const subscriptionId =
  typeof session.subscription === "string" ? session.subscription : null;

const paymentIntentId =
  typeof session.payment_intent === "string"
    ? session.payment_intent
    : null;

const stripeCustomerId =
  typeof session.customer === "string"
    ? session.customer
    : session.customer?.id || null;
  if (!userEmail || !purchaseType) {
    console.error("Webhook missing required metadata:", {
      sessionId: session.id,
      userEmail,
      purchaseType,
      metadata,
    });

    return;
  }

  const purchaseRow = {
    user_email: userEmail,
    purchase_type: purchaseType,
    project_slug: projectSlug || null,
    access_key: accessKey || null,
    stripe_checkout_session_id: session.id,
    stripe_payment_intent_id: paymentIntentId,
    stripe_subscription_id: subscriptionId,
    stripe_customer_id: stripeCustomerId,
    amount_cents: session.amount_total ?? null,
    currency: session.currency || "usd",
    status: "completed",
    completed_at: nowIso(),
    expires_at: expiresAt || null,
    kiiku_credits: kiikuCredits,
  };

  const purchaseRes = await supabaseAdmin
    .from("purchases")
    .upsert(purchaseRow, {
      onConflict: "stripe_checkout_session_id",
    });

  if (purchaseRes.error) {
    throw new Error(purchaseRes.error.message);
  }
}

async function unlockProject({
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
    {
      onConflict: "user_email,project_slug",
    }
  );

  if (res.error) {
    throw new Error(res.error.message);
  }
}

async function unlockAllAccessPass({
  userEmail,
  accessKey,
  expiresAt,
}: {
  userEmail: string;
  accessKey: string;
  expiresAt: string | null;
}) {
  const res = await supabaseAdmin.from("user_access_passes").upsert(
    {
      user_email: userEmail,
      access_key: accessKey,
      starts_at: nowIso(),
      expires_at: expiresAt,
    },
    {
      onConflict: "user_email,access_key",
    }
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

async function updatePurchaseStatus({
  purchaseId,
  status,
  expiresAt,
}: {
  purchaseId: string;
  status: string;
  expiresAt?: string | null;
}) {
  const updateValues: {
    status: string;
    expires_at?: string | null;
  } = {
    status,
  };

  if (expiresAt !== undefined) {
    updateValues.expires_at = expiresAt;
  }

  const res = await supabaseAdmin
    .from("purchases")
    .update(updateValues)
    .eq("id", purchaseId);

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
  const typedCharge = charge as Stripe.Charge & {
    invoice?: string | { id?: string | null } | null;
  };

  const paymentIntentId = getStripeId(charge.payment_intent);

  if (paymentIntentId) {
    const purchase = await findPurchaseByPaymentIntent(paymentIntentId);

    if (purchase) {
      return purchase;
    }
  }

  const invoiceId = getStripeId(typedCharge.invoice);

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
  const userEmail = normalizeValue(purchase.user_email);
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

  if (purchaseType === "kiiku_pass_30d" || purchaseType === "subscription") {
    await expireAccessPass({
      userEmail,
      accessKey: accessKey || "all_access",
    });
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const metadata = session.metadata || {};
  const userEmail = normalizeValue(
    metadata.user_email ||
      session.customer_details?.email ||
      session.customer_email
  );
  const purchaseType = normalizeValue(metadata.purchase_type);
  const projectSlug = normalizeValue(metadata.project_slug);
  const accessKey = normalizeValue(metadata.access_key || "all_access");

  if (!userEmail) {
    console.error("Checkout completed without user email:", session.id);
    return;
  }

  if (purchaseType === "project") {
    if (!projectSlug) {
      console.error("Project purchase missing project_slug:", session.id);
      return;
    }

    await recordCompletedPurchase({
      session,
      expiresAt: null,
    });

    await unlockProject({
      userEmail,
      projectSlug,
    });

    return;
  }

  if (purchaseType === "kiiku_pass_30d") {
    const expiresAt = await getExtendedPassExpiration({
      userEmail,
      accessKey,
      days: 30,
    });

    await recordCompletedPurchase({
      session,
      expiresAt,
    });

    await unlockAllAccessPass({
      userEmail,
      accessKey,
      expiresAt,
    });

    return;
  }

  if (purchaseType === "subscription") {
    await recordCompletedPurchase({
      session,
      expiresAt: null,
    });

    await unlockAllAccessPass({
      userEmail,
      accessKey,
      expiresAt: null,
    });

    const subscriptionId =
      typeof session.subscription === "string" ? session.subscription : null;

    if (subscriptionId) {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      await syncSubscriptionAccess(subscription);
    }

    return;
  }

  console.log("Unhandled checkout purchase type:", purchaseType);
}

async function resolveSubscriptionIdentity({
  subscription,
}: {
  subscription: Stripe.Subscription;
}) {
  const metadata = subscription.metadata || {};
  let userEmail = normalizeValue(metadata.user_email);
  let accessKey = normalizeValue(metadata.access_key || "all_access");

  if (!userEmail) {
    const purchaseRes = await supabaseAdmin
      .from("purchases")
      .select("user_email, access_key")
      .eq("stripe_subscription_id", subscription.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (purchaseRes.error) {
      throw new Error(purchaseRes.error.message);
    }

    userEmail = normalizeValue(purchaseRes.data?.user_email);
    accessKey = normalizeValue(purchaseRes.data?.access_key || accessKey);
  }

  if (!userEmail) {
    return null;
  }

  return {
    userEmail,
    accessKey: accessKey || "all_access",
  };
}

async function syncSubscriptionAccess(subscription: Stripe.Subscription) {
  const identity = await resolveSubscriptionIdentity({
    subscription,
  });

  if (!identity) {
    console.error("Subscription event without matching user:", subscription.id);
    return;
  }

  const typedSubscription = subscription as Stripe.Subscription & {
    cancel_at_period_end?: boolean | null;
  };

  const status = subscription.status;
  const periodEndIso = secondsToIso(getSubscriptionPeriodEnd(subscription));

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

  await unlockAllAccessPass({
    userEmail: identity.userEmail,
    accessKey: identity.accessKey,
    expiresAt,
  });

  const purchaseStatus =
    status === "active" || status === "trialing" ? "completed" : status;

  const purchaseRes = await supabaseAdmin
    .from("purchases")
    .update({
      status: purchaseStatus,
      expires_at: expiresAt,
    })
    .eq("stripe_subscription_id", subscription.id);

  if (purchaseRes.error) {
    throw new Error(purchaseRes.error.message);
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const identity = await resolveSubscriptionIdentity({
    subscription,
  });

  if (!identity) {
    console.error("Subscription deleted without matching user:", subscription.id);
    return;
  }

  const expiresAt = nowIso();

  await expireAccessPass({
    userEmail: identity.userEmail,
    accessKey: identity.accessKey || "all_access",
    expiresAt,
  });

  const purchaseRes = await supabaseAdmin
    .from("purchases")
    .update({
      status: "canceled",
      expires_at: expiresAt,
    })
    .eq("stripe_subscription_id", subscription.id);

  if (purchaseRes.error) {
    throw new Error(purchaseRes.error.message);
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
    expiresAt: nowIso(),
  });
}

async function handleDisputeCreated(dispute: Stripe.Dispute) {
  const chargeId = getStripeId(dispute.charge);

  if (!chargeId) {
    return;
  }

  const charge = await stripe.charges.retrieve(chargeId);
  const purchase = await findPurchaseFromCharge(charge);

  if (!purchase) {
    return;
  }

  await revokePurchaseAccess(purchase);

  await updatePurchaseStatus({
    purchaseId: purchase.id,
    status: "disputed",
    expiresAt: nowIso(),
  });
}

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    return NextResponse.json(
      { ok: false, error: "Missing STRIPE_WEBHOOK_SECRET" },
      { status: 500 }
    );
  }

  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { ok: false, error: "Missing Stripe signature" },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    const rawBody = await req.text();
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    console.error("Webhook signature verification failed:", error);

    return NextResponse.json(
      { ok: false, error: "Invalid webhook signature" },
      { status: 400 }
    );
  }

  try {
    const shouldProcess = await shouldProcessEvent(event);

    if (!shouldProcess) {
      return NextResponse.json({
        ok: true,
        duplicate: true,
      });
    }

    if (event.type === "checkout.session.completed") {
      await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
    }

    if (event.type === "customer.subscription.updated") {
      await syncSubscriptionAccess(event.data.object as Stripe.Subscription);
    }

    if (event.type === "customer.subscription.deleted") {
      await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
    }

    if (event.type === "invoice.paid") {
      await handleInvoiceSubscriptionSync(event.data.object as Stripe.Invoice);
    }

    if (event.type === "invoice.payment_failed") {
      await handleInvoiceSubscriptionSync(event.data.object as Stripe.Invoice);
    }

    if (event.type === "charge.refunded") {
      await handleRefundedCharge(event.data.object as Stripe.Charge);
    }

    if (event.type === "charge.dispute.created") {
      await handleDisputeCreated(event.data.object as Stripe.Dispute);
    }

    await markEventProcessed(event);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Webhook handler error:", error);

    await markEventFailed(event, error);

    return NextResponse.json(
      { ok: false, error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}
