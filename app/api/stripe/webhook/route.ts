import { NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase-admin";

function cleanEmail(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

async function recordPurchaseFromSession(session: Stripe.Checkout.Session) {
  const metadata = session.metadata || {};

  const userEmail =
    cleanEmail(metadata.user_email) ||
    cleanEmail(session.customer_email) ||
    cleanEmail(session.client_reference_id);

  const purchaseType = metadata.purchase_type || "";
  const projectSlug = metadata.project_slug || null;
  const accessKey = metadata.access_key || null;

  if (!userEmail || !purchaseType) {
    return;
  }

  const now = new Date().toISOString();

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id || null;

  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id || null;

  await supabaseAdmin.from("purchases").upsert(
    {
      user_email: userEmail,
      purchase_type: purchaseType,
      project_slug: projectSlug || null,
      access_key: accessKey || null,
      stripe_checkout_session_id: session.id,
      stripe_payment_intent_id: paymentIntentId,
      stripe_subscription_id: subscriptionId,
      amount_cents: session.amount_total || null,
      currency: session.currency || "usd",
      status: "completed",
      completed_at: now,
    },
    {
      onConflict: "stripe_checkout_session_id",
    }
  );

  if (purchaseType === "project" && projectSlug) {
    await supabaseAdmin.from("user_project_access").upsert(
      {
        user_email: userEmail,
        project_slug: projectSlug,
        access_type: "paid",
        starts_at: now,
        expires_at: null,
      },
      {
        onConflict: "user_email,project_slug",
      }
    );
  }

  if (purchaseType === "subscription") {
    await supabaseAdmin.from("user_access_passes").upsert(
      {
        user_email: userEmail,
        access_key: accessKey || "all_access",
        starts_at: now,
        expires_at: null,
      },
      {
        onConflict: "user_email,access_key",
      }
    );
  }
}

async function expireSubscriptionAccess(subscription: Stripe.Subscription) {
  const metadata = subscription.metadata || {};
  const userEmail = cleanEmail(metadata.user_email);
  const accessKey = metadata.access_key || "all_access";

  if (!userEmail) return;

  await supabaseAdmin
    .from("user_access_passes")
    .update({
      expires_at: new Date().toISOString(),
    })
    .eq("user_email", userEmail)
    .eq("access_key", accessKey);
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

  let event: Stripe.Event;

  try {
    const rawBody = await req.text();

    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      webhookSecret
    );
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Invalid webhook signature." },
      { status: 400 }
    );
  }

  try {
    if (event.type === "checkout.session.completed") {
      const checkoutSession = event.data.object as Stripe.Checkout.Session;
      await recordPurchaseFromSession(checkoutSession);
    }

    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as Stripe.Subscription;
      await expireSubscriptionAccess(subscription);
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Webhook handling error." },
      { status: 500 }
    );
  }
}
