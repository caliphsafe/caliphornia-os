import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { requiredEnv } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { processCheckoutSession, reversePurchaseEffectsByPaymentIntent } from "@/lib/payments/effects";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function claimWebhookEvent(event: Stripe.Event) {
  const inserted = await supabaseAdmin.from("stripe_webhook_events").insert({ id:event.id, type:event.type, status:"processing" }).select("id").single();
  if (!inserted.error) return true;
  const existing = await supabaseAdmin.from("stripe_webhook_events").select("status").eq("id", event.id).maybeSingle();
  return existing.data?.status === "failed";
}

async function finishWebhookEvent(event: Stripe.Event, status: "processed" | "failed", errorMessage?: string) {
  await supabaseAdmin.from("stripe_webhook_events").upsert({ id:event.id, type:event.type, status, error_message:errorMessage || null, processed_at:new Date().toISOString() }, { onConflict:"id" });
}

export async function POST(req: NextRequest) {
  const signature = req.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ ok:false }, { status:400 });
  const raw = await req.text();
  let event: Stripe.Event;
  try { event = stripe.webhooks.constructEvent(raw, signature, requiredEnv("STRIPE_WEBHOOK_SECRET")); }
  catch { return NextResponse.json({ ok:false }, { status:400 }); }
  const shouldProcess = await claimWebhookEvent(event);
  if (!shouldProcess) return NextResponse.json({ received:true, duplicate:true });
  try {
    if (event.type === "checkout.session.completed") await processCheckoutSession(event.data.object as Stripe.Checkout.Session);
    if (event.type === "charge.refunded") {
      const charge = event.data.object as Stripe.Charge;
      const paymentIntentId = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id || "";
      if (paymentIntentId) await reversePurchaseEffectsByPaymentIntent(paymentIntentId, "refund");
    }
    if (event.type === "charge.dispute.created") {
      const dispute = event.data.object as Stripe.Dispute;
      const paymentIntentId = typeof dispute.payment_intent === "string" ? dispute.payment_intent : dispute.payment_intent?.id || "";
      if (paymentIntentId) await reversePurchaseEffectsByPaymentIntent(paymentIntentId, "dispute");
    }
    await finishWebhookEvent(event, "processed");
    return NextResponse.json({ received:true });
  } catch (error) {
    await finishWebhookEvent(event, "failed", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ received:false }, { status:500 });
  }
}
