import { NextRequest, NextResponse } from "next/server";
import { requireCurrentAppUser } from "@/lib/users";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requiredEnv } from "@/lib/env";

export async function POST(req: NextRequest) {
  try {
    const user = await requireCurrentAppUser();
    const body = await req.json();
    const productKey = String(body.productKey || "");
    const product = await supabaseAdmin.from("commerce_products").select("*").eq("product_key", productKey).eq("status", "active").maybeSingle();
    if (!product.data) return NextResponse.json({ ok:false, error:"This product is not available." }, { status:404 });
    const lineItems = [{ productKey, type: product.data.product_type, songId: product.data.song_id, projectId: product.data.project_id, appId: product.data.app_id, amountCents: product.data.price_cents, currency: product.data.currency }];
    const session = await stripe.checkout.sessions.create({
      mode: product.data.product_type === "subscription" ? "subscription" : "payment",
      customer_email: user.email,
      line_items: [{ price_data: { currency: product.data.currency || "usd", product_data: { name: product.data.name }, unit_amount: Number(product.data.price_cents) }, quantity: 1 }],
      success_url: `${requiredEnv("NEXT_PUBLIC_SITE_URL")}/purchase/complete?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${requiredEnv("NEXT_PUBLIC_SITE_URL")}/purchase/cancelled`,
      metadata: { user_email:user.email, user_id:user.id, purchase_type:product.data.product_type, project_id:product.data.project_id || "", song_id:product.data.song_id || "", line_items: JSON.stringify(lineItems) }
    });
    return NextResponse.json({ ok:true, url: session.url });
  } catch {
    return NextResponse.json({ ok:false, error:"Could not create checkout." }, { status:500 });
  }
}
