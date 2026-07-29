import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { idempotencyKey, normalizeEmail } from "@/lib/crypto";
import { getOrCreateAppUser } from "@/lib/users";
import { createKiikuTransaction } from "@/lib/kiiku/ledger";

type Item = { productKey?: string; type: string; songId?: string | null; projectId?: string | null; appId?: string | null; quantity?: number; amountCents: number; currency?: string; metadata?: Record<string, unknown> };

export async function processCheckoutSession(session: Stripe.Checkout.Session) {
  const email = normalizeEmail(String(session.customer_details?.email || session.customer_email || session.metadata?.user_email || ""));
  if (!email) throw new Error("Missing checkout email.");
  const user = await getOrCreateAppUser(email);
  const amountCents = Number(session.amount_total || 0);
  const currency = String(session.currency || "usd");
  const items: Item[] = parseLineItems(session.metadata?.line_items, session.metadata, amountCents, currency);

  const purchase = await upsertPurchase({ userId: user.id, userEmail: user.email, session, amountCents, currency });
  for (let i = 0; i < items.length; i++) {
    await applyLineItemEffects({ purchaseId: purchase.id, userId: user.id, userEmail: user.email, session, item: items[i], index: i });
  }
  await supabaseAdmin.from("event_logs").upsert({ event_type:"purchase_completed", user_id:user.id, user_email:user.email, purchase_id:purchase.id, idempotency_key:idempotencyKey(["event","purchase_completed",purchase.id]), metadata:{ stripe_checkout_session_id:session.id } }, { onConflict:"idempotency_key" });
  return purchase;
}

function parseLineItems(raw: string | undefined, metadata: Stripe.Metadata | null, amountCents: number, currency: string): Item[] {
  if (raw) {
    try { const parsed = JSON.parse(raw); if (Array.isArray(parsed)) return parsed.map((x) => ({ ...x, amountCents: Number(x.amountCents || x.amount_cents || amountCents), currency: x.currency || currency })); } catch {}
  }
  const type = String(metadata?.purchase_type || metadata?.plan || "project_unlock");
  return [{ type, projectId: metadata?.project_id || null, songId: metadata?.song_id || null, amountCents, currency, metadata: metadata || {} }];
}

async function upsertPurchase(input: { userId: string; userEmail: string; session: Stripe.Checkout.Session; amountCents: number; currency: string }) {
  const row = {
    user_id: input.userId,
    user_email: input.userEmail,
    purchase_type: String(input.session.metadata?.purchase_type || input.session.metadata?.plan || "checkout"),
    project_slug: input.session.metadata?.project_slug || null,
    project_id: input.session.metadata?.project_id || null,
    access_key: input.session.metadata?.access_key || null,
    stripe_checkout_session_id: input.session.id,
    stripe_payment_intent_id: typeof input.session.payment_intent === "string" ? input.session.payment_intent : input.session.payment_intent?.id || null,
    stripe_subscription_id: typeof input.session.subscription === "string" ? input.session.subscription : input.session.subscription?.id || null,
    stripe_customer_id: typeof input.session.customer === "string" ? input.session.customer : input.session.customer?.id || null,
    amount_cents: input.amountCents,
    currency: input.currency,
    status: "completed",
    completed_at: new Date().toISOString(),
    idempotency_key: idempotencyKey(["purchase", input.session.id])
  };
  const { data, error } = await supabaseAdmin.from("purchases").upsert(row, { onConflict:"stripe_checkout_session_id" }).select("*").single();
  if (error) throw new Error(error.message);
  return data;
}

async function applyLineItemEffects(input: { purchaseId: string; userId: string; userEmail: string; session: Stripe.Checkout.Session; item: Item; index: number }) {
  const item = input.item;
  const lineKey = idempotencyKey(["line", input.purchaseId, input.index, item.type, item.songId, item.projectId]);
  const line = await supabaseAdmin.from("purchase_line_items").upsert({ purchase_id: input.purchaseId, product_key:item.productKey || null, product_type:item.type, song_id:item.songId || null, project_id:item.projectId || null, app_id:item.appId || null, quantity:item.quantity || 1, unit_amount_cents:item.amountCents, gross_amount_cents:item.amountCents, net_amount_cents:item.amountCents, eligible_amount_cents:item.amountCents, currency:item.currency || "usd", idempotency_key: lineKey, metadata:item.metadata || {} }, { onConflict:"idempotency_key" }).select("*").single();
  if (line.error) throw new Error(line.error.message);

  if (item.type === "song_unlock" && item.songId) {
    await supabaseAdmin.from("user_song_access").upsert({ user_id:input.userId, user_email:input.userEmail, song_id:item.songId, source_type:"purchase", source_purchase_id:input.purchaseId, status:"active", can_share:true, idempotency_key:idempotencyKey(["song_access", input.purchaseId, item.songId]) }, { onConflict:"idempotency_key" });
    await addToLibrary(input.userId, input.userEmail, item.songId, "purchase", input.purchaseId);
  }
  if (["project_unlock", "project_purchase"].includes(item.type) && item.projectId) {
    await supabaseAdmin.from("user_project_access").upsert({ user_id:input.userId, user_email:input.userEmail, project_id:item.projectId, source_type:"purchase", source_purchase_id:input.purchaseId, status:"active", can_share:true, idempotency_key:idempotencyKey(["project_access", input.purchaseId, item.projectId]) }, { onConflict:"idempotency_key" });
    await addProjectSongsToLibrary(input.userId, input.userEmail, item.projectId, input.purchaseId);
  }
  if (item.type === "subscription") {
  const subscriptionId =
    typeof input.session.subscription === "string"
      ? input.session.subscription
      : input.session.subscription?.id || null;

  await supabaseAdmin.from("user_access_passes").upsert(
    {
      user_id: input.userId,
      user_email: input.userEmail,
      access_key: String(input.session.metadata?.access_key || "music_full"),
      source_type: "subscription",
      source_purchase_id: input.purchaseId,
      stripe_subscription_id: subscriptionId,
      status: "active",
      idempotency_key: idempotencyKey([
        "pass_access",
        input.purchaseId,
        subscriptionId || "subscription",
      ]),
    },
    { onConflict: "idempotency_key" }
  );
}
  await maybeGrantShares(input, line.data);
  await maybeGrantKiiku(input, line.data);
  await maybeCreateContribution(input, line.data);
}

async function addToLibrary(userId: string, userEmail: string, songId: string, sourceType: string, purchaseId: string) {
  const song = await supabaseAdmin.from("songs").select("id,slug").eq("id", songId).maybeSingle();
  await supabaseAdmin.from("user_favorite_songs").upsert({ user_id:userId, user_email:userEmail, song_id:songId, song_slug:song.data?.slug || null, source_type:sourceType, source_purchase_id:purchaseId, status:"active" }, { onConflict:"user_id,song_id" });
}

async function addProjectSongsToLibrary(userId: string, userEmail: string, projectId: string, purchaseId: string) {
  const songs = await supabaseAdmin.from("songs").select("id,slug").eq("project_id", projectId);
  for (const song of songs.data || []) await supabaseAdmin.from("user_favorite_songs").upsert({ user_id:userId, user_email:userEmail, song_id:song.id, song_slug:song.slug, source_type:"purchase", source_purchase_id:purchaseId, status:"active" }, { onConflict:"user_id,song_id" });
}

async function maybeGrantShares(input: any, line: any) {
  const rules = await supabaseAdmin.from("sharing_rules").select("*").eq("status", "active").or(`product_type.eq.${line.product_type},project_id.eq.${line.project_id || "00000000-0000-0000-0000-000000000000"}`).limit(1).maybeSingle();
  const count = Number(rules.data?.shares_included || 0);
  if (count <= 0) return;
  await supabaseAdmin.from("sharing_allowances").upsert({ user_id:input.userId, user_email_snapshot:input.userEmail, project_id:line.project_id, song_id:line.song_id, purchase_id:input.purchaseId, allowance_type:"purchase_bonus", scope:line.song_id ? "song" : line.project_id ? "project" : "universal", total_allowed:count, remaining_count:count, status:"active", idempotency_key:idempotencyKey(["share_allowance", input.purchaseId, line.id]) }, { onConflict:"idempotency_key" });
}

async function maybeGrantKiiku(input: any, line: any) {
  const rules = await supabaseAdmin.from("kiiku_rules").select("*").eq("status", "active").eq("action_type", `${line.product_type}_purchase`).limit(1).maybeSingle();
  const amount = Number(rules.data?.credit_amount || 0);
  if (amount <= 0) return;
  await createKiikuTransaction({ userId:input.userId, amount, direction:"earn", transactionType:"purchase_reward", reason:`Purchase reward`, idempotencyKey:idempotencyKey(["kiiku_purchase", input.purchaseId, line.id, rules.data?.id]), ruleId:rules.data?.id, purchaseId:input.purchaseId, projectId:line.project_id, songId:line.song_id });
}

async function maybeCreateContribution(input: any, line: any) {
  if (!line.project_id) return;
  const goal = await supabaseAdmin.from("project_release_goals").select("*").eq("project_id", line.project_id).in("status", ["active", "goal_reached", "release_scheduled"]).limit(1).maybeSingle();
  if (!goal.data) return;
  const eligible = Number(line.eligible_amount_cents || 0);
  await supabaseAdmin.from("project_contributions").upsert({ project_id:line.project_id, goal_id:goal.data.id, user_id:input.userId, purchase_id:input.purchaseId, purchase_line_item_id:line.id, currency:line.currency, gross_amount_cents:line.gross_amount_cents, net_amount_cents:line.net_amount_cents, eligible_amount_cents:eligible, contribution_type:line.product_type, contribution_basis:String(goal.data.contribution_basis || "eligible_amount"), status:"confirmed", confirmed_at:new Date().toISOString(), idempotency_key:idempotencyKey(["contribution", input.purchaseId, line.id, line.project_id]) }, { onConflict:"idempotency_key" });
}

export async function reversePurchaseEffectsByPaymentIntent(paymentIntentId: string, type: "refund" | "dispute") {
  const purchase = await supabaseAdmin.from("purchases").select("*").eq("stripe_payment_intent_id", paymentIntentId).maybeSingle();
  if (!purchase.data?.id) return null;
  const status = type === "refund" ? "refunded" : "disputed";
  await supabaseAdmin.from("purchases").update({ status, reversed_at:new Date().toISOString() }).eq("id", purchase.data.id);
  await supabaseAdmin.from("user_project_access").update({ status, revoked_at:new Date().toISOString(), revoked_reason:type }).eq("source_purchase_id", purchase.data.id);
  await supabaseAdmin.from("user_song_access").update({ status, revoked_at:new Date().toISOString(), revoked_reason:type }).eq("source_purchase_id", purchase.data.id);
  await supabaseAdmin.from("user_access_passes").update({ status, revoked_at:new Date().toISOString(), revoked_reason:type }).eq("source_purchase_id", purchase.data.id);
  const contributions = await supabaseAdmin.from("project_contributions").select("*").eq("purchase_id", purchase.data.id).eq("status", "confirmed");
  for (const c of contributions.data || []) {
    await supabaseAdmin.from("project_contribution_reversals").upsert({ contribution_id:c.id, purchase_id:purchase.data.id, reversal_type:type, currency:c.currency, gross_reversed_cents:c.gross_amount_cents, net_reversed_cents:c.net_amount_cents, eligible_reversed_cents:c.eligible_amount_cents, status:"completed", idempotency_key:idempotencyKey(["contribution_reversal", type, c.id]) }, { onConflict:"idempotency_key" });
    await supabaseAdmin.from("project_contributions").update({ status:type === "refund" ? "refunded" : "disputed", reversed_at:new Date().toISOString() }).eq("id", c.id);
  }
  const rewards = await supabaseAdmin.from("kiiku_transactions").select("*").eq("purchase_id", purchase.data.id).eq("status", "approved").eq("direction", "earn");
  for (const r of rewards.data || []) {
    await createKiikuTransaction({ userId:r.user_id, amount:Number(r.amount), direction:"reversal", transactionType: type === "refund" ? "refund_reversal" : "dispute_reversal", status:"approved", reason:`${type} reversal`, idempotencyKey:idempotencyKey(["kiiku_reversal", type, r.id]), reversalOfTransactionId:r.id, purchaseId:purchase.data.id });
  }
  return purchase.data;
}
